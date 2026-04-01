/**
 * Auth Store — User authentication with PostgreSQL persistence.
 *
 * Primary: PostgreSQL (via DATABASE_URL env var) — survives Railway redeploys
 * Fallback: JSON file (for local dev without a database)
 *
 * Passwords hashed with Node's built-in crypto.scrypt.
 * JWT-like tokens using HMAC-SHA256 for session management.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { isAdminEmail } from "./subscription-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// ── Database connection ──

let pool = null;
let usePostgres = false;

async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("[auth] No DATABASE_URL — using JSON file fallback (data will not survive Railway redeploys)");
    loadUsersFromFile();
    return;
  }

  try {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();

    // Create users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) DEFAULT '',
        business_name VARCHAR(255) DEFAULT '',
        role VARCHAR(50) DEFAULT 'designer',
        email_verified BOOLEAN DEFAULT false,
        verified_at TIMESTAMP,
        deactivated BOOLEAN DEFAULT false,
        deactivated_at TIMESTAMP,
        deactivated_reason TEXT,
        phone VARCHAR(50),
        location VARCHAR(255),
        membership_id VARCHAR(255),
        preferences JSONB DEFAULT '{}',
        notifications JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    `);

    usePostgres = true;
    console.log("[auth] PostgreSQL connected — user data persists across deploys");

    // Migrate any existing JSON users into PostgreSQL
    await migrateJsonToPostgres();
  } catch (err) {
    console.error("[auth] PostgreSQL connection failed:", err.message);
    console.log("[auth] Falling back to JSON file storage");
    loadUsersFromFile();
  }
}

// Migrate existing users.json into PostgreSQL (one-time)
async function migrateJsonToPostgres() {
  try {
    if (!fs.existsSync(USERS_FILE)) return;
    const jsonUsers = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    const emails = Object.keys(jsonUsers);
    if (emails.length === 0) return;

    let migrated = 0;
    for (const email of emails) {
      const u = jsonUsers[email];
      try {
        await pool.query(
          `INSERT INTO users (id, email, password_hash, full_name, business_name, role, email_verified, verified_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (email) DO NOTHING`,
          [u.id, u.email, u.password_hash, u.full_name || "", u.business_name || "", u.role || "designer",
           u.email_verified || false, u.verified_at || null, u.created_at || new Date().toISOString()]
        );
        migrated++;
      } catch {}
    }
    if (migrated > 0) {
      console.log(`[auth] Migrated ${migrated} users from JSON to PostgreSQL`);
      // Rename the file so we don't re-migrate
      try { fs.renameSync(USERS_FILE, USERS_FILE + ".migrated"); } catch {}
    }
  } catch {}
}

// ── JSON file fallback (local dev) ──

let users = {};

function loadUsersFromFile() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
      console.log(`[auth] Loaded ${Object.keys(users).length} users from JSON file`);
    } else {
      console.log("[auth] No users file found, starting fresh");
    }
  } catch (err) {
    console.error("[auth] Failed to load users:", err.message);
    users = {};
  }
}

let saveTimer = null;
function saveUsersToFile() {
  // Immediate sync write for reliability
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    // Write to temp file first, then rename (atomic write)
    const tmpFile = USERS_FILE + ".tmp";
    fs.writeFileSync(tmpFile, JSON.stringify(users, null, 2));
    fs.renameSync(tmpFile, USERS_FILE);
  } catch (err) {
    // Fallback: direct write
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (err2) {
      console.error("[auth] Failed to save users:", err2.message);
    }
  }
}

// ── Token secret ──

const SECRET_FILE = path.join(DATA_DIR, ".auth-secret");
function getOrCreateSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET environment variable is required in production. Set a stable random string to prevent token invalidation on redeploy.");
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const saved = fs.readFileSync(SECRET_FILE, "utf8").trim();
      if (saved.length >= 32) return saved;
    }
  } catch {}
  const secret = crypto.randomBytes(32).toString("hex");
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SECRET_FILE, secret);
  } catch {}
  return secret;
}
const TOKEN_SECRET = getOrCreateSecret();
const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

console.log(`[auth] Token secret source: ${process.env.AUTH_SECRET ? "AUTH_SECRET env var (stable)" : ".auth-secret file (ephemeral on redeploy)"}`);

// ── Password hashing with scrypt ──

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

function verifyPassword(password, hash) {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(":");
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(crypto.timingSafeEqual(Buffer.from(key, "hex"), derivedKey));
    });
  });
}

// ── Token generation & verification ──

function generateToken(userId) {
  const payload = {
    sub: userId,
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const [payloadB64, signature] = token.split(".");
    const expectedSig = crypto
      .createHmac("sha256", TOKEN_SECRET)
      .update(payloadB64)
      .digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Login rate limiting (in-memory, resets on restart — that's fine) ──

const loginAttempts = {};
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export function checkLoginRateLimit(ip) {
  const record = loginAttempts[ip];
  if (!record) return { allowed: true };
  const elapsed = Date.now() - record.firstAttempt;
  const lockoutMs = LOCKOUT_MINUTES * 60 * 1000;
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    if (elapsed < lockoutMs) {
      return { allowed: false, retryAfterSeconds: Math.ceil((lockoutMs - elapsed) / 1000) };
    }
    delete loginAttempts[ip];
    return { allowed: true };
  }
  return { allowed: true };
}

export function recordFailedLogin(ip) {
  if (!loginAttempts[ip]) {
    loginAttempts[ip] = { count: 1, firstAttempt: Date.now() };
  } else {
    loginAttempts[ip].count += 1;
  }
}

export function clearLoginAttempts(ip) {
  delete loginAttempts[ip];
}

// ── Email verification (in-memory tokens — they're short-lived, that's fine) ──

const verificationTokens = {};

export function generateVerificationToken(userId, email) {
  const token = crypto.randomUUID();
  verificationTokens[token] = { userId, email, expiresAt: Date.now() + (24 * 60 * 60 * 1000) };
  return token;
}

export async function verifyEmail(token) {
  const record = verificationTokens[token];
  if (!record) return { ok: false, error: "Invalid verification link" };
  if (record.expiresAt < Date.now()) {
    delete verificationTokens[token];
    return { ok: false, error: "Verification link expired" };
  }

  if (usePostgres) {
    try {
      const res = await pool.query(
        `UPDATE users SET email_verified = true, verified_at = NOW() WHERE id = $1 RETURNING *`,
        [record.userId]
      );
      delete verificationTokens[token];
      if (res.rows.length === 0) return { ok: false, error: "User not found" };
      return { ok: true, user: sanitizeRow(res.rows[0]) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const user = Object.values(users).find(u => u.id === record.userId);
  if (!user) return { ok: false, error: "User not found" };
  user.email_verified = true;
  user.verified_at = new Date().toISOString();
  saveUsersToFile();
  delete verificationTokens[token];
  return { ok: true, user: sanitizeUser(user) };
}

// ── Password reset (in-memory tokens — they're short-lived) ──

const resetTokens = {};

export function generateResetToken(email) {
  // Don't reveal if email exists
  const findUser = usePostgres
    ? null // handled below
    : Object.values(users).find(u => u.email === email.toLowerCase().trim());

  if (usePostgres) {
    // We need sync access but pool is async — use a wrapper
    return _generateResetTokenAsync(email);
  }

  if (!findUser) return { ok: true };
  const token = crypto.randomUUID();
  resetTokens[token] = { userId: findUser.id, expiresAt: Date.now() + (60 * 60 * 1000) };
  return { ok: true, token, email: findUser.email };
}

async function _generateResetTokenAsync(email) {
  try {
    const res = await pool.query(`SELECT id, email FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
    if (res.rows.length === 0) return { ok: true };
    const token = crypto.randomUUID();
    resetTokens[token] = { userId: res.rows[0].id, expiresAt: Date.now() + (60 * 60 * 1000) };
    return { ok: true, token, email: res.rows[0].email };
  } catch {
    return { ok: true };
  }
}

export async function resetPassword(token, newPassword) {
  const record = resetTokens[token];
  if (!record) return { ok: false, error: "Invalid or expired reset link" };
  if (record.expiresAt < Date.now()) {
    delete resetTokens[token];
    return { ok: false, error: "Reset link has expired" };
  }
  if (!newPassword || newPassword.length < 8) return { ok: false, error: "Password must be at least 8 characters" };
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
    return { ok: false, error: "Password must contain at least one number or special character" };
  }

  const hash = await hashPassword(newPassword);

  if (usePostgres) {
    try {
      await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, record.userId]);
      delete resetTokens[token];
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const user = Object.values(users).find(u => u.id === record.userId);
  if (!user) return { ok: false, error: "User not found" };
  user.password_hash = hash;
  user.updated_at = new Date().toISOString();
  saveUsersToFile();
  delete resetTokens[token];
  return { ok: true };
}

// ── Public API ──

export async function registerUser({ email, password, full_name, business_name }) {
  if (!email || !password) return { ok: false, error: "Email and password are required" };

  const normalizedEmail = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, error: "Invalid email address" };
  }
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters" };
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { ok: false, error: "Password must contain at least one number or special character" };
  }

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  const role = isAdminEmail(normalizedEmail) ? "admin" : "designer";
  const emailVerified = isAdminEmail(normalizedEmail);

  if (usePostgres) {
    try {
      const res = await pool.query(
        `INSERT INTO users (id, email, password_hash, full_name, business_name, role, email_verified, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [id, normalizedEmail, passwordHash, (full_name || "").trim(), (business_name || "").trim(), role, emailVerified]
      );
      const user = sanitizeRow(res.rows[0]);
      const token = generateToken(id);
      console.log(`[auth] Registered user: ${normalizedEmail} (PostgreSQL)`);
      return { ok: true, user, token };
    } catch (err) {
      if (err.code === "23505") return { ok: false, error: "An account with this email already exists" };
      console.error("[auth] Registration error:", err.message);
      return { ok: false, error: "Registration failed" };
    }
  }

  // JSON fallback
  if (users[normalizedEmail]) return { ok: false, error: "An account with this email already exists" };
  users[normalizedEmail] = {
    id, email: normalizedEmail, full_name: (full_name || "").trim(), business_name: (business_name || "").trim(),
    password_hash: passwordHash, role, email_verified: emailVerified, created_at: new Date().toISOString(),
  };
  saveUsersToFile();
  const token = generateToken(id);
  return { ok: true, user: sanitizeUser(users[normalizedEmail]), token };
}

export async function loginUser({ email, password }) {
  if (!email || !password) return { ok: false, error: "Email and password are required" };
  const normalizedEmail = email.toLowerCase().trim();

  if (usePostgres) {
    try {
      const res = await pool.query(`SELECT * FROM users WHERE email = $1`, [normalizedEmail]);
      if (res.rows.length === 0) return { ok: false, error: "Invalid email or password" };
      const row = res.rows[0];
      if (row.deactivated) return { ok: false, error: "Account has been deactivated. Contact support for assistance." };
      const valid = await verifyPassword(password, row.password_hash);
      if (!valid) return { ok: false, error: "Invalid email or password" };
      // Update last login
      await pool.query(`UPDATE users SET updated_at = NOW() WHERE id = $1`, [row.id]).catch(() => {});
      const token = generateToken(row.id);
      return { ok: true, user: sanitizeRow(row), token };
    } catch (err) {
      console.error("[auth] Login error:", err.message);
      return { ok: false, error: "Login failed" };
    }
  }

  const userRecord = users[normalizedEmail];
  if (!userRecord) return { ok: false, error: "Invalid email or password" };
  if (userRecord.deactivated) return { ok: false, error: "Account has been deactivated. Contact support for assistance." };
  const valid = await verifyPassword(password, userRecord.password_hash);
  if (!valid) return { ok: false, error: "Invalid email or password" };
  const token = generateToken(userRecord.id);
  return { ok: true, user: sanitizeUser(userRecord), token };
}

export async function getUserFromToken(token) {
  const payload = verifyToken(token);
  if (!payload) return { ok: false, error: "Invalid or expired token" };

  if (usePostgres) {
    try {
      const res = await pool.query(`SELECT * FROM users WHERE id = $1`, [payload.sub]);
      if (res.rows.length === 0) return { ok: false, error: "User not found" };
      if (res.rows[0].deactivated) return { ok: false, error: "Account has been deactivated" };
      return { ok: true, user: sanitizeRow(res.rows[0]) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const userRecord = Object.values(users).find(u => u.id === payload.sub);
  if (!userRecord) return { ok: false, error: "User not found" };
  if (userRecord.deactivated) return { ok: false, error: "Account has been deactivated" };
  return { ok: true, user: sanitizeUser(userRecord) };
}

export async function updateUser(userId, updates) {
  const allowed = [
    "full_name", "business_name", "role", "phone", "location",
    "membership_id", "preferences", "notifications",
    "deactivated", "deactivated_at", "deactivated_reason",
  ];

  if (usePostgres) {
    try {
      const setClauses = [];
      const values = [];
      let idx = 1;
      for (const key of allowed) {
        if (updates[key] !== undefined) {
          setClauses.push(`${key} = $${idx}`);
          values.push(key === "preferences" || key === "notifications" ? JSON.stringify(updates[key]) : updates[key]);
          idx++;
        }
      }
      if (setClauses.length === 0) return { ok: false, error: "No valid fields to update" };
      setClauses.push(`updated_at = NOW()`);
      values.push(userId);
      const res = await pool.query(
        `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (res.rows.length === 0) return { ok: false, error: "User not found" };
      return { ok: true, user: sanitizeRow(res.rows[0]) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const userRecord = Object.values(users).find(u => u.id === userId);
  if (!userRecord) return { ok: false, error: "User not found" };
  for (const key of allowed) {
    if (updates[key] !== undefined) userRecord[key] = updates[key];
  }
  saveUsersToFile();
  return { ok: true, user: sanitizeUser(userRecord) };
}

export async function changePassword(userId, { current_password, new_password }) {
  if (!current_password || !new_password) return { ok: false, error: "Current and new password are required" };
  if (new_password.length < 8) return { ok: false, error: "New password must be at least 8 characters" };
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(new_password)) {
    return { ok: false, error: "New password must contain at least one number or special character" };
  }

  if (usePostgres) {
    try {
      const res = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
      if (res.rows.length === 0) return { ok: false, error: "User not found" };
      const valid = await verifyPassword(current_password, res.rows[0].password_hash);
      if (!valid) return { ok: false, error: "Current password is incorrect" };
      const hash = await hashPassword(new_password);
      await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, userId]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const userRecord = Object.values(users).find(u => u.id === userId);
  if (!userRecord) return { ok: false, error: "User not found" };
  const valid = await verifyPassword(current_password, userRecord.password_hash);
  if (!valid) return { ok: false, error: "Current password is incorrect" };
  userRecord.password_hash = await hashPassword(new_password);
  saveUsersToFile();
  return { ok: true };
}

export async function deleteUser(userId) {
  if (usePostgres) {
    try {
      const res = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING email`, [userId]);
      if (res.rows.length === 0) return { ok: false, error: "User not found" };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const email = Object.keys(users).find(e => users[e].id === userId);
  if (!email) return { ok: false, error: "User not found" };
  delete users[email];
  saveUsersToFile();
  return { ok: true };
}

export async function exportUserData(userId) {
  if (usePostgres) {
    try {
      const res = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
      if (res.rows.length === 0) return { ok: false, error: "User not found" };
      const { password_hash, ...data } = res.rows[0];
      return { ok: true, data: { profile: data, exported_at: new Date().toISOString() } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const userRecord = Object.values(users).find(u => u.id === userId);
  if (!userRecord) return { ok: false, error: "User not found" };
  const { password_hash, ...data } = userRecord;
  return { ok: true, data: { profile: data, exported_at: new Date().toISOString() } };
}

export function extractToken(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return authHeader;
}

export async function getAllUsers() {
  if (usePostgres) {
    try {
      const res = await pool.query(`SELECT * FROM users ORDER BY created_at DESC`);
      return res.rows.map(sanitizeRow);
    } catch (err) {
      console.error("[auth] getAllUsers error:", err.message);
      return [];
    }
  }
  return Object.values(users).map(u => { const { password_hash, ...safe } = u; return safe; });
}

// ── Helpers ──

function sanitizeUser(record) {
  const { password_hash, ...user } = record;
  return user;
}

function sanitizeRow(row) {
  if (!row) return null;
  const { password_hash, ...user } = row;
  return user;
}

// ── Init ──

// Export the init function so server.mjs can await it before starting
export { initDatabase };
