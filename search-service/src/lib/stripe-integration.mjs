/**
 * Stripe Integration — handles checkout sessions, webhooks, subscription lifecycle.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY — Stripe secret key (sk_test_... or sk_live_...)
 *   STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret (whsec_...)
 *   STRIPE_MONTHLY_PRICE_ID — Stripe Price ID for $79/month plan
 *   STRIPE_ANNUAL_PRICE_ID — Stripe Price ID for $790/year plan
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
 * Create a Stripe Checkout session for subscription.
 * @param {string} plan - "monthly" or "annual"
 * @param {string} email - customer email
 * @param {string} userId - internal user ID
 * @param {string} successUrl - redirect URL on success
 * @param {string} cancelUrl - redirect URL on cancel
 */
async function createCheckoutSession(plan, email, userId, successUrl, cancelUrl) {
  if (!await ensureStripe()) {
    throw new Error("Stripe not configured");
  }

  const priceId = plan === "annual"
    ? process.env.STRIPE_ANNUAL_PRICE_ID
    : process.env.STRIPE_MONTHLY_PRICE_ID;

  if (!priceId) {
    throw new Error(`Stripe price ID not configured for plan: ${plan}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { user_id: userId, plan },
    subscription_data: {
      metadata: { user_id: userId, plan },
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
  if (!stripe) throw new Error("Stripe not configured");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
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
  verifyWebhook,
  cancelSubscription,
  reactivateSubscription,
  createReactivationSession,
  getStripeSubscription,
  createPortalSession,
};
