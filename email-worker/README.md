# Zoe Medical — form email Worker

A small Cloudflare Worker that receives the website form submissions
(homepage quote form, **Contact**, and **Service & repairs**) and emails
each one to **customersupport@zoemedical.com** using Cloudflare Email
Sending. This replaces Formspree.

## How it fits together

```
Browser form  ──POST──▶  zoe-form-worker  ──env.EMAIL.send()──▶  customersupport@zoemedical.com
```

- `js/forms.js` (in the site root) intercepts the form submit and POSTs to
  this Worker, then shows an inline success/error message.
- The Worker builds an email from the submitted fields and sends it.
- `replyTo` is set to the visitor's email, so replying in your inbox goes
  straight back to them.

## One-time setup

> Requires the Cloudflare account that owns the **zoemedical.com** zone.
> If zoemedical.com isn't on this Cloudflare account yet, add it as a zone
> first (or change `FROM_ADDRESS` in `src/index.js` to a domain that is).

```bash
cd email-worker
npm install

# 1. Log in (opens a browser)
npx wrangler login

# 2. Onboard the SENDING domain (adds SPF + DKIM DNS records).
#    The "from" address must live on this domain.
npx wrangler email sending enable zoemedical.com
npx wrangler email sending dns get zoemedical.com   # confirm records are live

# 3. Deploy
npx wrangler deploy
```

`wrangler deploy` prints the Worker URL, e.g.
`https://zoe-form-worker.rhiltz.workers.dev`.

## Wire the site to the Worker

The forms post to whatever URL is in their `action=` attribute, and
`js/forms.js` reuses that. If your deployed URL differs from the default,
update the `action="…"` on these three forms:

- `index.html`  (homepage quote form)
- `contact.html`
- `service.html`

Default used in the markup: `https://zoe-form-worker.rhiltz.workers.dev`

Also make sure your site's origin is listed in `ALLOWED_ORIGINS` at the top
of `src/index.js` (CORS). Then re-deploy if you changed it.

## Test locally

```bash
# Sends REAL email (remote binding). Use an address you control to test.
npx wrangler dev --remote
```

Then POST a sample submission:

```bash
curl -X POST http://localhost:8787 \
  -d "reason=service-request" \
  -d "serial_number=740S-0001234" \
  -d "contact_name=Jane Smith" \
  -d "email=jane@example.com" \
  -d "problem_description=NIBP not inflating"
```

## Notes

- **Spam:** each form has a hidden honeypot field (`_gotcha`). If you start
  getting spam, add Cloudflare Turnstile in front of the forms.
- **Deliverability:** keep SPF/DKIM healthy; consider a DMARC record on
  zoemedical.com. See the Cloudflare Email Sending docs.
- This Worker is separate from the chatbot Worker (`zoe-support-worker`).
