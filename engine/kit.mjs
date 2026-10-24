/*!
 * Sends the weekly digest to RegSignal subscribers as a Kit (kit.com) broadcast.
 * Subscriber addresses stay in Kit; this code only sends the email content.
 * Copyright 2026 Khan Gulrez Shagufa Fazal Ahmed. Licensed under the Apache License 2.0.
 */
export const KIT_API = 'https://api.kit.com/v4';

/**
 * Creates a broadcast that Kit sends to all confirmed subscribers a few minutes later.
 * Returns { ok, id?, error? }. Never throws, so a mail problem cannot stop the weekly run.
 */
export async function sendBroadcast({ apiKey, subject, html, previewText, fetchImpl = fetch, now = new Date() }) {
  if (!apiKey) return { ok: false, skipped: true, error: 'No KIT_API_KEY secret is set, so no email was sent.' };
  const body = {
    subject,
    content: html,
    description: `RegSignal weekly digest ${now.toISOString().slice(0, 10)}`,
    preview_text: previewText || '',
    public: false,
    send_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
  };
  try {
    const res = await fetchImpl(`${KIT_API}/broadcasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Kit-Api-Key': apiKey },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    if (!res.ok) {
      const msg = json?.errors ? [].concat(json.errors).join('; ') : text.slice(0, 300);
      return { ok: false, error: `Kit answered HTTP ${res.status}: ${msg}` };
    }
    return { ok: true, id: json?.broadcast?.id ?? null, send_at: body.send_at };
  } catch (e) {
    return { ok: false, error: `Could not reach Kit (${e.message}).` };
  }
}
