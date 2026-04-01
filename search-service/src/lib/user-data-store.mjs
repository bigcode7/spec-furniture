/**
 * User Data Store — Server-side persistence for favorites, quotes, and search history.
 * Uses PostgreSQL (Neon) when DATABASE_URL is set, falls back to in-memory.
 */

import pg from "pg";
const { Pool } = pg;

let pool = null;
let usePostgres = false;

export async function initUserDataStore() {
  if (process.env.DATABASE_URL) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 3,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: { rejectUnauthorized: false },
      });

      await pool.query(`
        CREATE TABLE IF NOT EXISTS saved_products (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL,
          product_id VARCHAR(255) NOT NULL,
          product_data JSONB DEFAULT '{}',
          saved_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, product_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_quotes (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL,
          quote_data JSONB NOT NULL DEFAULT '{}',
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS search_history (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL,
          query TEXT NOT NULL,
          result_count INTEGER DEFAULT 0,
          searched_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Shared quotes — client approval portal
      await pool.query(`
        CREATE TABLE IF NOT EXISTS shared_quotes (
          id SERIAL PRIMARY KEY,
          token VARCHAR(64) NOT NULL UNIQUE,
          user_id UUID NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          quote_data JSONB NOT NULL DEFAULT '{}',
          designer_name VARCHAR(255),
          designer_company VARCHAR(255),
          designer_email VARCHAR(255),
          project_name VARCHAR(255),
          client_note TEXT,
          client_email VARCHAR(255),
          feedback JSONB DEFAULT '{}',
          feedback_submitted_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_shared_quotes_token ON shared_quotes(token)`).catch(() => {});
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_shared_quotes_user ON shared_quotes(user_id)`).catch(() => {});

      // Add indexes
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_saved_products_user ON saved_products(user_id)`).catch(() => {});
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id)`).catch(() => {});

      usePostgres = true;
      console.log("[user-data-store] PostgreSQL tables initialized");
    } catch (err) {
      console.error("[user-data-store] PostgreSQL init failed:", err.message);
    }
  }
}

// ── Favorites ──

export async function getSavedProducts(userId) {
  if (!usePostgres || !userId) return [];
  try {
    const res = await pool.query(
      `SELECT product_id, product_data, saved_at FROM saved_products WHERE user_id = $1 ORDER BY saved_at DESC`,
      [userId]
    );
    return res.rows.map(r => ({ ...r.product_data, id: r.product_id, savedAt: r.saved_at }));
  } catch (err) {
    console.error("[user-data-store] getSavedProducts error:", err.message);
    return [];
  }
}

export async function saveProduct(userId, product) {
  if (!usePostgres || !userId || !product?.id) return { ok: false };
  try {
    const productData = {
      product_name: product.product_name,
      manufacturer_name: product.manufacturer_name,
      image_url: product.image_url,
      portal_url: product.portal_url,
      material: product.material,
      style: product.style,
      retail_price: product.retail_price,
      category: product.category,
    };
    await pool.query(
      `INSERT INTO saved_products (user_id, product_id, product_data) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [userId, product.id, JSON.stringify(productData)]
    );
    return { ok: true, added: true };
  } catch (err) {
    console.error("[user-data-store] saveProduct error:", err.message);
    return { ok: false, error: err.message };
  }
}

export async function unsaveProduct(userId, productId) {
  if (!usePostgres || !userId) return { ok: false };
  try {
    await pool.query(
      `DELETE FROM saved_products WHERE user_id = $1 AND product_id = $2`,
      [userId, productId]
    );
    return { ok: true };
  } catch (err) {
    console.error("[user-data-store] unsaveProduct error:", err.message);
    return { ok: false, error: err.message };
  }
}

// ── Quotes ──

export async function getUserQuote(userId) {
  if (!usePostgres || !userId) return null;
  try {
    const res = await pool.query(
      `SELECT quote_data, updated_at FROM user_quotes WHERE user_id = $1`,
      [userId]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0].quote_data;
  } catch (err) {
    console.error("[user-data-store] getUserQuote error:", err.message);
    return null;
  }
}

export async function saveUserQuote(userId, quoteData) {
  if (!usePostgres || !userId) return { ok: false };
  try {
    await pool.query(
      `INSERT INTO user_quotes (user_id, quote_data, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET quote_data = $2, updated_at = NOW()`,
      [userId, JSON.stringify(quoteData)]
    );
    return { ok: true };
  } catch (err) {
    console.error("[user-data-store] saveUserQuote error:", err.message);
    return { ok: false, error: err.message };
  }
}

// ── Shared Quotes (Client Approval Portal) ──

import crypto from "node:crypto";

export async function createSharedQuote(userId, { quoteData, designerName, designerCompany, designerEmail, projectName, clientNote, clientEmail }) {
  if (!usePostgres || !userId) return { ok: false, error: "No database" };
  try {
    const token = crypto.randomBytes(24).toString("hex");
    const res = await pool.query(
      `INSERT INTO shared_quotes (token, user_id, version, quote_data, designer_name, designer_company, designer_email, project_name, client_note, client_email)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9)
       RETURNING token, version, created_at`,
      [token, userId, JSON.stringify(quoteData), designerName || null, designerCompany || null, designerEmail || null, projectName || null, clientNote || null, clientEmail || null]
    );
    return { ok: true, token: res.rows[0].token, version: res.rows[0].version };
  } catch (err) {
    console.error("[user-data-store] createSharedQuote error:", err.message);
    return { ok: false, error: err.message };
  }
}

export async function getSharedQuote(token) {
  if (!usePostgres || !token) return null;
  try {
    const res = await pool.query(
      `SELECT * FROM shared_quotes WHERE token = $1`,
      [token]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  } catch (err) {
    console.error("[user-data-store] getSharedQuote error:", err.message);
    return null;
  }
}

export async function submitQuoteFeedback(token, feedback) {
  if (!usePostgres || !token) return { ok: false };
  try {
    await pool.query(
      `UPDATE shared_quotes SET feedback = $1, feedback_submitted_at = NOW(), updated_at = NOW() WHERE token = $2`,
      [JSON.stringify(feedback), token]
    );
    return { ok: true };
  } catch (err) {
    console.error("[user-data-store] submitQuoteFeedback error:", err.message);
    return { ok: false, error: err.message };
  }
}

export async function getDesignerSharedQuotes(userId) {
  if (!usePostgres || !userId) return [];
  try {
    const res = await pool.query(
      `SELECT token, version, project_name, client_email, feedback, feedback_submitted_at, created_at, updated_at
       FROM shared_quotes WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    return res.rows;
  } catch (err) {
    console.error("[user-data-store] getDesignerSharedQuotes error:", err.message);
    return [];
  }
}

export async function updateSharedQuote(token, userId, { quoteData, clientNote }) {
  if (!usePostgres || !token || !userId) return { ok: false };
  try {
    const res = await pool.query(
      `UPDATE shared_quotes
       SET quote_data = $1, version = version + 1, client_note = COALESCE($2, client_note),
           feedback = '{}', feedback_submitted_at = NULL, updated_at = NOW()
       WHERE token = $3 AND user_id = $4
       RETURNING version`,
      [JSON.stringify(quoteData), clientNote || null, token, userId]
    );
    if (res.rows.length === 0) return { ok: false, error: "Not found" };
    return { ok: true, version: res.rows[0].version };
  } catch (err) {
    console.error("[user-data-store] updateSharedQuote error:", err.message);
    return { ok: false, error: err.message };
  }
}

// ── Search History ──

export async function addSearchHistory(userId, query, resultCount) {
  if (!usePostgres || !userId) return;
  try {
    await pool.query(
      `INSERT INTO search_history (user_id, query, result_count) VALUES ($1, $2, $3)`,
      [userId, query, resultCount]
    );
    // Keep only last 50 per user
    await pool.query(
      `DELETE FROM search_history WHERE id IN (
        SELECT id FROM search_history WHERE user_id = $1 ORDER BY searched_at DESC OFFSET 50
      )`,
      [userId]
    );
  } catch (err) {
    console.error("[user-data-store] addSearchHistory error:", err.message);
  }
}

export async function getSearchHistory(userId) {
  if (!usePostgres || !userId) return [];
  try {
    const res = await pool.query(
      `SELECT query, result_count, searched_at FROM search_history WHERE user_id = $1 ORDER BY searched_at DESC LIMIT 50`,
      [userId]
    );
    return res.rows;
  } catch (err) {
    console.error("[user-data-store] getSearchHistory error:", err.message);
    return [];
  }
}
