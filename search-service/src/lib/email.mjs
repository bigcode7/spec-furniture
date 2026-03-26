/**
 * Email service using Resend API.
 * Sends transactional emails for auth, subscriptions, and notifications.
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_EMAIL = "SPEKD <hello@spekd.ai>";
const NOREPLY_EMAIL = "SPEKD <noreply@spekd.ai>";

function getApiKey() {
  return process.env.RESEND_API_KEY || null;
}

function getAppUrl() {
  return process.env.APP_URL || "https://spekd.ai";
}

async function sendEmail({ to, subject, html }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — would send to ${to}: "${subject}"`);
    return { ok: true, simulated: true };
  }

  try {
    const resp = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error(`[email] Resend error ${resp.status}: ${err.slice(0, 200)}`);
      return { ok: false, error: err };
    }

    const data = await resp.json();
    console.log(`[email] Sent "${subject}" to ${to} (id: ${data.id})`);
    return { ok: true, id: data.id };
  } catch (err) {
    console.error(`[email] Send failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// ── Email wrapper (dark brand template) ──

function wrap(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#080c18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080c18;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <!-- Logo -->
  <tr><td style="padding-bottom:32px;text-align:center;">
    <span style="font-size:24px;font-weight:700;letter-spacing:0.15em;color:#C9A96E;">SPEKD</span>
  </td></tr>
  <!-- Content -->
  <tr><td style="background-color:#0e0e14;border-radius:12px;border:1px solid rgba(255,255,255,0.06);padding:40px 32px;">
    ${content}
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding-top:24px;text-align:center;">
    <p style="font-size:11px;color:rgba(255,255,255,0.25);margin:0;">
      SPEKD — AI-Powered Trade Furniture Sourcing<br>
      <a href="${getAppUrl()}" style="color:rgba(201,169,110,0.4);text-decoration:none;">spekd.ai</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function button(text, url) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td align="center">
  <a href="${url}" style="display:inline-block;padding:14px 32px;background-color:#C9A96E;color:#080c18;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">${text}</a>
</td></tr></table>`;
}

// ── Email templates ──

export async function sendVerificationEmail(to, token) {
  const url = `${getAppUrl()}/auth/verify-email?token=${token}`;
  return sendEmail({
    to,
    subject: "Verify your SPEKD account",
    html: wrap(`
      <h2 style="color:rgba(255,255,255,0.9);font-size:20px;margin:0 0 16px;">Verify your email</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 8px;">
        Welcome to SPEKD. Click below to verify your email and start sourcing furniture with AI intelligence.
      </p>
      ${button("Verify Email", url)}
      <p style="color:rgba(255,255,255,0.25);font-size:12px;margin:0;">
        This link expires in 24 hours. If you didn't create an account, ignore this email.
      </p>
    `),
  });
}

export async function sendPasswordResetEmail(to, token) {
  const url = `${getAppUrl()}/Search?reset_token=${token}`;
  return sendEmail({
    to,
    subject: "Reset your SPEKD password",
    html: wrap(`
      <h2 style="color:rgba(255,255,255,0.9);font-size:20px;margin:0 0 16px;">Reset your password</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 8px;">
        We received a request to reset your password. Click below to choose a new one.
      </p>
      ${button("Reset Password", url)}
      <p style="color:rgba(255,255,255,0.25);font-size:12px;margin:0;">
        This link expires in 1 hour. If you didn't request a reset, ignore this email.
      </p>
    `),
  });
}

export async function sendWelcomeEmail(to, name) {
  const displayName = name || "there";
  return sendEmail({
    to,
    subject: "Welcome to SPEKD Pro — here's how to get the most out of your trial",
    html: wrap(`
      <h2 style="color:rgba(255,255,255,0.9);font-size:20px;margin:0 0 16px;">Welcome, ${displayName}</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 16px;">
        Your SPEKD account is verified and ready. Here's how designers get the most out of the platform:
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
        <tr><td style="padding:8px 0;color:rgba(201,169,110,0.7);font-size:14px;font-weight:600;">1.</td>
            <td style="padding:8px 0 8px 12px;color:rgba(255,255,255,0.5);font-size:14px;">Search naturally — "moody leather sofa, not modern"</td></tr>
        <tr><td style="padding:8px 0;color:rgba(201,169,110,0.7);font-size:14px;font-weight:600;">2.</td>
            <td style="padding:8px 0 8px 12px;color:rgba(255,255,255,0.5);font-size:14px;">Build quotes with trade pricing and client markup</td></tr>
        <tr><td style="padding:8px 0;color:rgba(201,169,110,0.7);font-size:14px;font-weight:600;">3.</td>
            <td style="padding:8px 0 8px 12px;color:rgba(255,255,255,0.5);font-size:14px;">Use "Find Similar" to source across 20+ vendors instantly</td></tr>
      </table>
      ${button("Start Searching", getAppUrl() + "/Search")}
    `),
  });
}

export async function sendTrialEndingEmail(to, name, searchCount) {
  const displayName = name || "there";
  return sendEmail({
    to,
    subject: "Your trial ends in 2 days — you've searched " + searchCount + " times",
    html: wrap(`
      <h2 style="color:rgba(255,255,255,0.9);font-size:20px;margin:0 0 16px;">Your trial is ending soon</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 8px;">
        Hey ${displayName}, you've run ${searchCount} searches across 42,000+ trade furniture products. Your free trial ends in 2 days.
      </p>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 8px;">
        Upgrade to Pro to keep unlimited access to AI-powered search, quotes, and trade pricing.
      </p>
      ${button("Upgrade to Pro — $99/mo", getAppUrl() + "/Search?upgrade=true")}
    `),
  });
}

export async function sendSubscriptionConfirmationEmail(to, name, plan) {
  const displayName = name || "there";
  const planLabel = plan === "pro_annual" ? "Pro Annual" : plan === "team_monthly" ? "Team" : "Pro";
  return sendEmail({
    to,
    subject: "Your SPEKD Pro subscription is active",
    html: wrap(`
      <h2 style="color:rgba(255,255,255,0.9);font-size:20px;margin:0 0 16px;">You're all set, ${displayName}</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 8px;">
        Your SPEKD ${planLabel} subscription is now active. You have unlimited access to:
      </p>
      <ul style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 16px;">
        <li>AI-powered search across 42,000+ trade products</li>
        <li>Unlimited quotes with trade pricing</li>
        <li>Find Similar — cross-vendor sourcing</li>
        <li>PDF quote generation with client markup</li>
      </ul>
      ${button("Continue Sourcing", getAppUrl() + "/Search")}
    `),
  });
}

export async function sendPaymentFailedEmail(to, name) {
  const displayName = name || "there";
  return sendEmail({
    to,
    subject: "Your payment failed — update your card to keep Pro access",
    html: wrap(`
      <h2 style="color:rgba(255,255,255,0.9);font-size:20px;margin:0 0 16px;">Payment issue</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 8px;">
        Hey ${displayName}, your latest SPEKD payment didn't go through. Please update your payment method to keep your Pro access.
      </p>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 8px;">
        Your account will remain active for 7 days while we retry the charge.
      </p>
      ${button("Update Payment Method", getAppUrl() + "/Search?billing=true")}
    `),
  });
}
