/**
 * Auth Store — Self-contained user authentication system.
 *
 * Uses SQLite (via better-sqlite3) for user storage.
 * Passwords hashed with Node's built-in crypto.scrypt.
 * JWT-like tokens using HMAC-SHA256 for session management.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Token secret — persisted to file so tokens survive server restarts
const SECRET_FILE = path.join(DATA_DIR, ".auth-secret");
function getOrCreateSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
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

// ── In-memory user store backed by JSON file ──

let users = {};

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    }
  } catch {
    users = {};
  }
}

function saveUsers() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("[auth] Failed to save users:", err.message);
  }
}

let saveUsersTimer = null;
function saveUsersDebounced() {
  if (saveUsersTimer) clearTimeout(saveUsersTimer);
  saveUsersTimer = setTimeout(() => {
    saveUsers();
    saveUsersTimer = null;
  }, 500);
}

loadUsers();

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

// ── Login rate limiting ──

const loginAttempts = {}; // keyed by IP → { count, firstAttempt }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Check if an IP is allowed to attempt login.
 * @param {string} ip
 * @returns {{ allowed: boolean, retryAfterSeconds?: number }}
 */
export function checkLoginRateLimit(ip) {
  const record = loginAttempts[ip];
  if (!record) return { allowed: true };

  const elapsed = Date.now() - record.firstAttempt;
  const lockoutMs = LOCKOUT_MINUTES * 60 * 1000;

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    if (elapsed < lockoutMs) {
      const retryAfterSeconds = Math.ceil((lockoutMs - elapsed) / 1000);
      return { allowed: false, retryAfterSeconds };
    }
    // Lockout period expired — reset
    delete loginAttempts[ip];
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Record a failed login attempt for an IP.
 * @param {string} ip
 */
export function recordFailedLogin(ip) {
  if (!loginAttempts[ip]) {
    loginAttempts[ip] = { count: 1, firstAttempt: Date.now() };
  } else {
    loginAttempts[ip].count += 1;
  }
}

/**
 * Clear login attempts for an IP (called on successful login).
 * @param {string} ip
 */
export function clearLoginAttempts(ip) {
  delete loginAttempts[ip];
}

// ── Email verification ──

const verificationTokens = {}; // keyed by token → { userId, email, expiresAt }

/**
 * Generate an email verification token for a user.
 * @param {string} userId
 * @param {string} email
 * @returns {string} token
 */
export function generateVerificationToken(userId, email) {
  const token = crypto.randomUUID();
  verificationTokens[token] = {
    userId,
    email,
    expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
  };
  return token;
}

/**
 * Verify an email using a verification token.
 * @param {string} token
 * @returns {{ ok: boolean, user?: object, error?: string }}
 */
export function verifyEmail(token) {
  const record = verificationTokens[token];
  if (!record) return { ok: false, error: "Invalid verification link" };
  if (record.expiresAt < Date.now()) {
    delete verificationTokens[token];
    return { ok: false, error: "Verification link expired" };
  }
  // Mark user as verified
  const user = Object.values(users).find(u => u.id === record.userId);
  if (!user) return { ok: false, error: "User not found" };
  user.email_verified = true;
  user.verified_at = new Date().toISOString();
  saveUsersDebounced();
  delete verificationTokens[token];
  return { ok: true, user: sanitizeUser(user) };
}

// ── Password reset ──

const resetTokens = {}; // keyed by token → { userId, expiresAt }

/**
 * Generate a password reset token for an email.
 * Returns ok: true even if email doesn't exist (to avoid revealing user existence).
 * @param {string} email
 * @returns {{ ok: boolean, token?: string, email?: string }}
 */
export function generateResetToken(email) {
  const user = Object.values(users).find(u => u.email === email.toLowerCase().trim());
  if (!user) return { ok: true }; // Don't reveal if email exists
  const token = crypto.randomUUID();
  resetTokens[token] = {
    userId: user.id,
    expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
  };
  return { ok: true, token, email: user.email };
}

/**
 * Reset a user's password using a reset token.
 * @param {string} token
 * @param {string} newPassword
 * @returns {{ ok: boolean, error?: string }}
 */
export function resetPassword(token, newPassword) {
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
  const user = Object.values(users).find(u => u.id === record.userId);
  if (!user) return { ok: false, error: "User not found" };
  user.password_hash = hashPasswordSync(newPassword);
  user.updated_at = new Date().toISOString();
  saveUsersDebounced();
  delete resetTokens[token];
  return { ok: true };
}

// ── Public API ──

/**
 * Register a new user.
 * @param {{ email: string, password: string, full_name: string, business_name?: string }} data
 * @returns {{ ok: boolean, user?: object, token?: string, verification_token?: string, error?: string }}
 */
export async function registerUser({ email, password, full_name, business_name }) {
  if (!email || !password) {
    return { ok: false, error: "Email and password are required" };
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, error: "Invalid email address" };
  }

  // Validate password strength
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { ok: false, error: "Password must contain at least one number or special character" };
  }

  // Check if user exists
  if (users[normalizedEmail]) {
    return { ok: false, error: "An account with this email already exists" };
  }

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();

  users[normalizedEmail] = {
    id,
    email: normalizedEmail,
    full_name: (full_name || "").trim(),
    business_name: (business_name || "").trim(),
    password_hash: passwordHash,
    role: "designer",
    email_verified: false,
    created_at: new Date().toISOString(),
  };

  saveUsers();

  const token = generateToken(id);
  const user = sanitizeUser(users[normalizedEmail]);
  const verification_token = generateVerificationToken(id, normalizedEmail);

  return { ok: true, user, token, verification_token };
}

/**
 * Authenticate a user.
 * @param {{ email: string, password: string }} data
 * @returns {{ ok: boolean, user?: object, token?: string, error?: string }}
 */
export async function loginUser({ email, password }) {
  if (!email || !password) {
    return { ok: false, error: "Email and password are required" };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const userRecord = users[normalizedEmail];

  if (!userRecord) {
    return { ok: false, error: "Invalid email or password" };
  }

  if (userRecord.deactivated) {
    return { ok: false, error: "Account has been deactivated. Contact support for assistance." };
  }

  const valid = await verifyPassword(password, userRecord.password_hash);
  if (!valid) {
    return { ok: false, error: "Invalid email or password" };
  }

  const token = generateToken(userRecord.id);
  const user = sanitizeUser(userRecord);

  return { ok: true, user, token };
}

/**
 * Get user from token.
 * @param {string} token
 * @returns {{ ok: boolean, user?: object, error?: string }}
 */
export function getUserFromToken(token) {
  const payload = verifyToken(token);
  if (!payload) {
    return { ok: false, error: "Invalid or expired token" };
  }

  // Find user by ID
  const userRecord = Object.values(users).find(u => u.id === payload.sub);
  if (!userRecord) {
    return { ok: false, error: "User not found" };
  }

  if (userRecord.deactivated) {
    return { ok: false, error: "Account has been deactivated" };
  }

  return { ok: true, user: sanitizeUser(userRecord) };
}

/**
 * Update user profile.
 * @param {string} userId
 * @param {object} updates
 * @returns {{ ok: boolean, user?: object, error?: string }}
 */
export function updateUser(userId, updates) {
  const userRecord = Object.values(users).find(u => u.id === userId);
  if (!userRecord) {
    return { ok: false, error: "User not found" };
  }

  const allowed = [
    "full_name", "business_name", "role",
    "phone", "location", "membership_id",
    "preferences", "notifications",
    "deactivated", "deactivated_at", "deactivated_reason",
  ];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      userRecord[key] = updates[key];
    }
  }

  saveUsers();
  return { ok: true, user: sanitizeUser(userRecord) };
}

/**
 * Change user password.
 */
export async function changePassword(userId, { current_password, new_password }) {
  if (!current_password || !new_password) {
    return { ok: false, error: "Current and new password are required" };
  }
  if (new_password.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters" };
  }

  const userRecord = Object.values(users).find(u => u.id === userId);
  if (!userRecord) {
    return { ok: false, error: "User not found" };
  }

  const valid = await verifyPassword(current_password, userRecord.password_hash);
  if (!valid) {
    return { ok: false, error: "Current password is incorrect" };
  }

  userRecord.password_hash = await hashPassword(new_password);
  saveUsers();
  return { ok: true };
}

/**
 * Delete user account permanently.
 */
export function deleteUser(userId) {
  const email = Object.keys(users).find(e => users[e].id === userId);
  if (!email) {
    return { ok: false, error: "User not found" };
  }
  delete users[email];
  saveUsers();
  return { ok: true };
}

/**
 * Export all user data (GDPR-style).
 */
export function exportUserData(userId) {
  const userRecord = Object.values(users).find(u => u.id === userId);
  if (!userRecord) {
    return { ok: false, error: "User not found" };
  }
  const { password_hash, ...data } = userRecord;
  return { ok: true, data: { profile: data, exported_at: new Date().toISOString() } };
}

/**
 * Extract bearer token from Authorization header.
 */
export function extractToken(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  return authHeader; // Fallback: treat whole header as token
}

/**
 * Get all users with sensitive fields stripped.
 * @returns {object[]}
 */
export function getAllUsers() {
  return Object.values(users).map(u => {
    const { password_hash, ...safe } = u;
    return safe;
  });
}

// Strip sensitive fields
function sanitizeUser(record) {
  const { password_hash, ...user } = record;
  return user;
}
