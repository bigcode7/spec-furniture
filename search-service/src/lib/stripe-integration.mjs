/**
 * Stripe Integration — handles checkout sessions, webhooks, subscription lifecycle.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY — Stripe secret key (sk_test_... or sk_live_...)
 *   STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret (whsec_...)
 *
 * Pricing tier env vars:
 *   STRIPE_PRO_MONTHLY_PRICE_ID  — $99/month
 *   STRIPE_PRO_ANNUAL_PRICE_ID   — $990/year
 *   STRIPE_EARLY_BIRD_PRICE_ID   — $49/month (first 200 users, locked for life)
 *   STRIPE_TEAM_MONTHLY_PRICE_ID — $249/month (5 seats included)
 *   STRIPE_TEAM_ANNUAL_PRICE_ID  — $2,490/year (5 seats included)
 *   STRIPE_TEAM_SEAT_PRICE_ID    — $49/month per additional seat
 *
 * Legacy / backward-compat (used as fallback for pro plans):
 *   STRIPE_MONTHLY_PRICE_ID — falls back for pro_monthly if new var not set
 *   STRIPE_ANNUAL_PRICE_ID  — falls back for pro_annual if new var not set
 */
import crypto from "node:crypto";

let stripe = null;

async function initStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.warn("[stripe] STRIPE_SECRET_KEY not set — Stripe integration disabled");
    return false;
  }
  // Dynamic import since stripe may not be available
  try {
    const Stripe = (await import("stripe")).default;
    stripe = new Stripe(key, { apiVersion: "2024-12-18.acacia" });
    console.log("[stripe] Initialized");
    return true;
  } catch (err) {
    console.error("[stripe] Failed to initialize:", err.message);
    return false;
  }
}

// Make initStripe async
async function ensureStripe() {
  if (stripe) return true;
  return await initStripe();
}

/**
 * Resolve a Stripe Price ID for the given plan.
 *
 * Supported plans:
 *   "pro_monthly"  | "monthly"  — Pro monthly ($99/mo)
 *   "pro_annual"   | "annual"   — Pro annual  ($990/yr)
 *   "team_monthly"              — Team monthly ($249/mo, 5 seats)
 *   "team_annual"               — Team annual  ($2,490/yr, 5 seats)
 *
 * Legacy "monthly" / "annual" values are treated as pro plans for backward
 * compatibility.
 */
function resolvePriceId(plan) {
  switch (plan) {
    case "early_bird":
      return process.env.STRIPE_EARLY_BIRD_PRICE_ID;
    case "pro_monthly":
    case "monthly":
      return (
        process.env.STRIPE_PRO_MONTHLY_PRICE_ID ||
        process.env.STRIPE_MONTHLY_PRICE_ID
      );
    case "pro_annual":
    case "annual":
      return (
        process.env.STRIPE_PRO_ANNUAL_PRICE_ID ||
        process.env.STRIPE_ANNUAL_PRICE_ID
      );
    case "team_monthly":
      return process.env.STRIPE_TEAM_MONTHLY_PRICE_ID;
    case "team_annual":
      return process.env.STRIPE_TEAM_ANNUAL_PRICE_ID;
    default:
      return undefined;
  }
}

/**
 * Create a Stripe Checkout session for subscription.
 * @param {string} plan - "pro_monthly", "pro_annual", "team_monthly", "team_annual",
 *                        or legacy "monthly" / "annual"
 * @param {string} email - customer email
 * @param {string} userId - internal user ID
 * @param {string} successUrl - redirect URL on success
 * @param {string} cancelUrl - redirect URL on cancel
 */
// ── Redirect URL validation (phishing prevention) ──
const ALLOWED_DOMAINS = ["spekd.ai", "www.spekd.ai", "localhost", "127.0.0.1"];

function validateRedirectUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const isAllowed = ALLOWED_DOMAINS.some(
      (domain) => host === domain || host.endsWith("." + domain)
    );
    if (!isAllowed) {
      console.warn(`[stripe] Blocked redirect to untrusted domain: ${host}`);
      return "https://spekd.ai";
    }
    return url;
  } catch {
    return "https://spekd.ai";
  }
}

async function createCheckoutSession(plan, email, userId, successUrl, cancelUrl) {
  if (!await ensureStripe()) {
    throw new Error("Stripe not configured");
  }

  const priceId = resolvePriceId(plan);

  if (!priceId) {
    throw new Error(`Stripe price ID not configured for plan: ${plan}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: validateRedirectUrl(successUrl),
    cancel_url: validateRedirectUrl(cancelUrl),
    metadata: { user_id: userId, plan },
    subscription_data: {
      trial_period_days: 7,
      metadata: { user_id: userId, plan },
    },
  });

  return { checkout_url: session.url, session_id: session.id };
}

/**
 * Create a Stripe Checkout session for purchasing additional team seats.
 * @param {string} stripeCustomerId - existing Stripe customer ID
 * @param {number} quantity - number of additional seats to purchase
 * @param {string} successUrl - redirect URL on success
 * @param {string} cancelUrl - redirect URL on cancel
 */
async function createTeamSeatCheckout(stripeCustomerId, quantity, successUrl, cancelUrl) {
  if (!await ensureStripe()) {
    throw new Error("Stripe not configured");
  }

  const seatPriceId = process.env.STRIPE_TEAM_SEAT_PRICE_ID;
  if (!seatPriceId) {
    throw new Error("STRIPE_TEAM_SEAT_PRICE_ID not configured");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: stripeCustomerId,
    line_items: [{ price: seatPriceId, quantity }],
    success_url: validateRedirectUrl(successUrl),
    cancel_url: validateRedirectUrl(cancelUrl),
    metadata: { plan: "team_seat_addon", seat_quantity: String(quantity) },
    subscription_data: {
      metadata: { plan: "team_seat_addon", seat_quantity: String(quantity) },
    },
  });

  return { checkout_url: session.url, session_id: session.id };
}

/**
 * Verify and parse a Stripe webhook event.
 * @param {Buffer} body - raw request body
 * @param {string} signature - Stripe-Signature header
 */
function verifyWebhook(body, signature) {
  if (!stripe) {
    console.warn("[stripe] Webhook received but Stripe not configured — ignoring");
    return null;
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("[stripe] Webhook received but STRIPE_WEBHOOK_SECRET not set — ignoring");
    return null;
  }
  return stripe.webhooks.constructEvent(body, signature, webhookSecret);
}

/**
 * Cancel a subscription in Stripe.
 * @param {string} stripeSubscriptionId
 * @param {boolean} immediate - if true, cancel immediately; if false, cancel at period end
 */
async function cancelSubscription(stripeSubscriptionId, immediate = false) {
  if (!await ensureStripe()) throw new Error("Stripe not configured");

  if (immediate) {
    return await stripe.subscriptions.cancel(stripeSubscriptionId);
  } else {
    return await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

/**
 * Reactivate a cancelled subscription (before period end).
 */
async function reactivateSubscription(stripeSubscriptionId) {
  if (!await ensureStripe()) throw new Error("Stripe not configured");
  return await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Create a new checkout session for reactivation (after subscription has ended).
 */
async function createReactivationSession(plan, email, userId, successUrl, cancelUrl) {
  return createCheckoutSession(plan, email, userId, successUrl, cancelUrl);
}

/**
 * Get subscription details from Stripe.
 */
async function getStripeSubscription(stripeSubscriptionId) {
  if (!await ensureStripe()) throw new Error("Stripe not configured");
  return await stripe.subscriptions.retrieve(stripeSubscriptionId);
}

/**
 * Create a Stripe billing portal session for the customer to manage payment methods.
 */
async function createPortalSession(stripeCustomerId, returnUrl) {
  if (!await ensureStripe()) throw new Error("Stripe not configured");
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return { portal_url: session.url };
}

export {
  initStripe,
  ensureStripe,
  createCheckoutSession,
  createTeamSeatCheckout,
  verifyWebhook,
  cancelSubscription,
  reactivateSubscription,
  createReactivationSession,
  getStripeSubscription,
  createPortalSession,
};
