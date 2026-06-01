import Stripe from 'stripe';
import { coupons as allCoupons } from '../src/data/coupons.js';

export default async function handler(req, res) {
  // CORS headers so the browser can call this from the frontend
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { priceId, deckName, deckPrice, sleeveOption, sleeveColor, sleevePrice, couponCode } = req.body;

  if (!priceId && !deckPrice) return res.status(400).json({ error: 'Missing priceId or deckPrice' });

  // Shipping rates
  const FREE_SHIPPING_RATE     = process.env.STRIPE_SHIPPING_FREE;
  const STANDARD_SHIPPING_RATE = process.env.STRIPE_SHIPPING_STANDARD;

  // Pick shipping option based on deck price (+ sleeve if applicable)
  const deckTotal = Number(deckPrice) || 0;
  const shippingOptions = [];
  if (FREE_SHIPPING_RATE && STANDARD_SHIPPING_RATE) {
    shippingOptions.push({
      shipping_rate: deckTotal >= 150 ? FREE_SHIPPING_RATE : STANDARD_SHIPPING_RATE,
    });
  }

  // ── Coupon validation (read from shared coupons.js) ─────────────────────────
  const couponKey = (couponCode || '').toLowerCase().trim();
  const couponDef = allCoupons.find(c => c.active && c.code.toLowerCase() === couponKey) ?? null;

  // Build line items — deck + optional sleeve add-on
  // Use an existing Stripe price ID when available; otherwise create an ad-hoc price_data
  // (used for Elite builds that don't yet have a dedicated Stripe price ID)
  const deckLineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        price_data: {
          currency: 'usd',
          product_data: { name: deckName || 'Commander Deck' },
          unit_amount: Math.round(Number(deckPrice) * 100),
        },
        quantity: 1,
      };
  const lineItems = [deckLineItem];

  if (sleeveOption && sleeveOption !== 'none' && Number(sleevePrice) > 0) {
    const isSingle = sleeveOption === 'single';
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: isSingle
            ? 'Single Sleeve — Perfect Fit Inner Protective Sleeves'
            : `Double Sleeve — Perfect Fit Inner + ${sleeveColor ?? ''} Premium Outer Sleeves`,
          description: isSingle
            ? '100-card deck pre-sleeved with Perfect Fit clear inner protective sleeves.'
            : `100-card deck double-sleeved: snug Perfect Fit inner sleeve inside a ${sleeveColor ?? ''} premium outer sleeve.`,
          images: [],
        },
        unit_amount: Math.round(Number(sleevePrice) * 100), // cents
      },
      quantity: 1,
    });
  }

  // Apply coupon as a negative discount line item
  if (couponDef) {
    const subtotal = Number(deckPrice || 0) + Number(sleevePrice || 0);
    const discountCents = Math.round(subtotal * (couponDef.percent / 100) * 100);
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Coupon: ${(couponCode || '').toUpperCase()} (${couponDef.percent}% off)`,
        },
        unit_amount: -discountCents,
      },
      quantity: 1,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      // Omitting payment_method_types lets Stripe automatically show every method
      // enabled in your Dashboard: cards, Google Pay, Apple Pay, PayPal, etc.
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.SITE_URL}/success`,
      cancel_url:  `${process.env.SITE_URL}/shop`,
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'NZ', 'IE', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK'],
      },
      ...(shippingOptions.length > 0 && { shipping_options: shippingOptions }),
      metadata: { deckName: deckName ?? 'Unknown' },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
