/**
 * POST /api/send-restock-emails
 * Body: { deckId, deckName, deckPrice }
 *
 * Reads subscribers from the Resend "lotus-waitlist" audience,
 * filters to those who signed up for this specific deck (stored in firstName),
 * sends each a branded restock email, then removes them from the audience.
 */

import { Resend } from 'resend';

const AUDIENCE_NAME = 'lotus-waitlist';

async function getAudienceId(resend) {
  const result = await resend.audiences.list();
  return result.data?.data?.find(a => a.name === AUDIENCE_NAME)?.id ?? null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'RESEND_API_KEY not configured.' });
  }

  const { deckId, deckSlug, deckName, deckPrice } = req.body ?? {};
  if (!deckId || !deckName) return res.status(400).json({ error: 'Missing deckId or deckName.' });

  try {
    const resend     = new Resend(process.env.RESEND_API_KEY);
    const audienceId = await getAudienceId(resend);
    if (!audienceId) return res.status(200).json({ sent: 0, message: 'No waitlist audience yet.' });

    const contactsResult = await resend.contacts.list({ audienceId });
    const all            = contactsResult.data?.data ?? [];
    const subscribers    = all.filter(c => c.first_name === String(deckId));

    if (!subscribers.length) return res.status(200).json({ sent: 0 });

    const siteUrl = process.env.SITE_URL || 'https://lotusprodecks.com';
    const deckUrl = `${siteUrl}/deck/${deckSlug || deckId}`;
    let sent = 0;

    for (const contact of subscribers) {
      try {
        await resend.emails.send({
          from:    'Lotus Pro Decks <noreply@lotusprodecks.com>',
          to:      contact.email,
          subject: `🪷 ${deckName} is back in stock — grab it before it's gone`,
          html:    buildEmail({ deckName, deckPrice, deckUrl, siteUrl }),
        });
        sent++;
        // Remove from audience — they've been notified
        await resend.contacts.remove({ audienceId, id: contact.id });
      } catch (err) {
        console.error(`[send-restock-emails] failed for ${contact.email}:`, err.message);
      }
    }

    return res.status(200).json({ sent, total: subscribers.length });
  } catch (err) {
    console.error('[send-restock-emails]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Email template ───────────────────────────────────────────────────────────
function buildEmail({ deckName, deckPrice, deckUrl, siteUrl }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">🪷 Lotus Pro Decks</div>
      <div style="color:#6b7280;font-size:14px;margin-top:4px;">Back in Stock Alert</div>
    </div>

    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;margin-bottom:20px;">
      <div style="display:inline-block;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);color:#c084fc;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:16px;">
        🔒 Limited Run — Back In Stock
      </div>
      <h2 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#ffffff;">${deckName}</h2>
      <p style="margin:0 0 20px;color:#9ca3af;font-size:15px;line-height:1.6;">
        You asked us to let you know — and here we are. This deck just restocked,
        but quantities are <strong style="color:#f59e0b;">strictly limited</strong>.
        These are handcrafted builds, never mass-produced. Once it sells out, it's gone again.
      </p>
      ${deckPrice ? `<div style="font-size:32px;font-weight:800;color:#60a5fa;margin-bottom:20px;">$${deckPrice}</div>` : ''}
      <a href="${deckUrl}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#7c3aed);color:#ffffff;font-weight:700;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Claim Your Deck →
      </a>
    </div>

    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:14px;margin-bottom:24px;text-align:center;">
      <div style="color:#f59e0b;font-size:13px;font-weight:600;">⚡ First come, first served — waitlist subscribers notified first</div>
    </div>

    <div style="text-align:center;color:#4b5563;font-size:12px;line-height:1.6;">
      You received this because you joined the waitlist on
      <a href="${siteUrl}" style="color:#6b7280;">${siteUrl.replace('https://','')}</a>.<br>
      Lotus Pro Decks is not affiliated with Wizards of the Coast.
    </div>

  </div>
</body>
</html>`;
}
