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

// Token secret — generated once per server start, or use env var
const TOKEN_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");
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

// ── Public API ──

/**
 * Register a new user.
 * @param {{ email: string, password: string, full_name: string, business_name?: string }} data
 * @returns {{ ok: boolean, user?: object, token?: string, error?: string }}
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
    created_at: new Date().toISOString(),
  };

  saveUsers();

  const token = generateToken(id);
  const user = sanitizeUser(users[normalizedEmail]);

  return { ok: true, user, token };
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

  const allowed = ["full_name", "business_name", "role"];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      userRecord[key] = updates[key];
    }
  }

  saveUsers();
  return { ok: true, user: sanitizeUser(userRecord) };
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

// Strip sensitive fields
function sanitizeUser(record) {
  const { password_hash, ...user } = record;
  return user;
}
