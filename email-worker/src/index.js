/*
  Zoe Medical — website form email Worker
  =======================================
  Receives POSTs from the website forms (homepage quote form, contact
  form, and service/repair form) and emails each submission using the
  Cloudflare Email Sending binding (env.EMAIL). Service / repair
  requests go to service@zoemedical.com; everything else goes to
  customersupport@zoemedical.com. No third-party form vendor involved.

  Forms post application/x-www-form-urlencoded (or multipart) — both
  are handled by request.formData().

  IMPORTANT — before this works in production:
    1. zoemedical.com must be onboarded to Cloudflare Email Sending:
         npx wrangler email sending enable zoemedical.com
       (adds SPF + DKIM DNS records — see email-worker/README.md)
    2. FROM_ADDRESS below must use that onboarded domain.
    3. Deploy:  cd email-worker && npm install && npx wrangler deploy
    4. Point the forms' action= at the deployed Worker URL.
*/

/* Origins allowed to POST to this Worker (your site). Edit as needed. */
const ALLOWED_ORIGINS = [
  "https://rhiltz22.github.io",   // GitHub Pages project site
  "https://zoemedical.com",
  "https://www.zoemedical.com",
  "http://localhost:8080",        // local testing
  "http://127.0.0.1:5500",
];

const TO_ADDRESS      = "customersupport@zoemedical.com"; // sales / support / general
const SERVICE_ADDRESS = "service@zoemedical.com";         // service & repair requests
const FROM_ADDRESS = "website@zoemedical.com";   // MUST be on an onboarded sending domain
const FROM_NAME    = "Zoe Medical Website";

/* Human-friendly labels + a sensible display order for the email body. */
const LABELS = {
  reason:              "Reason",
  contact_name:        "Contact name",
  first_name:          "First name",
  last_name:           "Last name",
  name:                "Name",
  organization:        "Organization",
  org:                 "Organization",
  email:               "Email",
  phone:               "Phone",
  serial_number:       "Serial number",
  loaner:              "Loaner requested",
  shipping_address:    "Shipping address",
  problem_description: "Problem description",
  message:             "Message",
};
const ORDER = [
  "reason", "contact_name", "first_name", "last_name", "name",
  "organization", "org", "email", "phone", "serial_number", "loaner",
  "shipping_address", "problem_description", "message",
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405, origin);
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: "Invalid form submission." }, 400, origin);
    }

    /* Honeypot: bots fill hidden fields, humans leave them empty.
       Pretend success so the bot doesn't retry, but send nothing. */
    if ((form.get("_gotcha") || "").toString().trim() !== "") {
      return json({ ok: true }, 200, origin);
    }

    /* Collect real fields (skip internal _underscore fields). */
    const fields = {};
    for (const [k, v] of form.entries()) {
      if (k.startsWith("_")) continue;
      const val = v.toString().trim();
      if (val) fields[k] = val;
    }

    const reason     = (fields.reason || "general").toLowerCase();
    const isService  = reason === "service-request";
    const replyEmail = fields.email || "";
    const name =
      fields.contact_name ||
      [fields.first_name, fields.last_name].filter(Boolean).join(" ") ||
      fields.name ||
      "Website visitor";

    const subject = isService
      ? `Service / repair request${fields.serial_number ? ` — S/N ${fields.serial_number}` : ""}`
      : `Website enquiry (${reason}) — ${name}`;

    const { text, html } = buildBody(isService, name, fields);

    const payload = {
      to: isService ? SERVICE_ADDRESS : TO_ADDRESS,
      from: { email: FROM_ADDRESS, name: FROM_NAME },
      subject,
      text,
      html,
    };
    /* Set reply-to so support can reply straight to the customer. */
    if (replyEmail) payload.replyTo = replyEmail;

    try {
      await env.EMAIL.send(payload);
    } catch (err) {
      console.error("Email send failed:", err && err.code, err && err.message);
      return json(
        { ok: false, error: "We couldn't send your message. Please email customersupport@zoemedical.com directly." },
        502,
        origin
      );
    }

    return json({ ok: true }, 200, origin);
  },
};

/* ---------- helpers ---------- */

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function buildBody(isService, name, fields) {
  const keys = Object.keys(fields);
  const ordered = ORDER.filter((k) => keys.includes(k))
    .concat(keys.filter((k) => !ORDER.includes(k)));

  const rows = ordered.map((k) => ({ label: LABELS[k] || k, value: fields[k] }));
  const heading = isService ? "New service / repair request" : "New website enquiry";

  const text =
    `${heading}\n\n` +
    rows.map((r) => `${r.label}: ${r.value}`).join("\n");

  const html =
    `<h2 style="font-family:Arial,Helvetica,sans-serif;color:#83161f;margin:0 0 12px;">${escapeHtml(heading)}</h2>` +
    `<table style="font-family:Arial,Helvetica,sans-serif;border-collapse:collapse;font-size:14px;">` +
    rows
      .map(
        (r) =>
          `<tr>` +
          `<td style="padding:4px 16px 4px 0;vertical-align:top;color:#6B7280;font-weight:bold;">${escapeHtml(r.label)}</td>` +
          `<td style="padding:4px 0;vertical-align:top;color:#111827;white-space:pre-wrap;">${escapeHtml(r.value)}</td>` +
          `</tr>`
      )
      .join("") +
    `</table>`;

  return { text, html };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
