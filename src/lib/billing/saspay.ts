/**
 * SasPay (https://docs.saspay.me): Mobile Money (MTN MoMo, Orange Money) and cards in West and
 * Central Africa. Hosted checkout: we create a session, redirect the customer to checkout_url,
 * then always re-check the real status with SasPay before activating anything.
 */
import crypto from "crypto";

const API = process.env.SASPAY_API_URL || "https://api.saspay.me/api/v1";

export class SasPayError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export const isSasPayConfigured = () => Boolean(process.env.SASPAY_SECRET_KEY);

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.SASPAY_SECRET_KEY;
  if (!key) throw new SasPayError("SASPAY_SECRET_KEY manquante", 503);
  const res = await fetch(`${API}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new SasPayError(json?.message || json?.detail || `HTTP ${res.status}`, res.status);
  return json as T;
}

export interface CheckoutSession {
  id: string;
  slug: string;
  checkout_url: string;
  status: string;
}

export function createCheckout(input: {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  returnUrl: string;
  metadata: Record<string, string>;
}) {
  return call<CheckoutSession>("/checkout-sessions/", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amount.toFixed(2),
      currency: "XAF",
      country: "CM",
      description: input.description,
      customer_email: input.customerEmail,
      customer_name: input.customerName,
      return_url: input.returnUrl,
      metadata: input.metadata,
    }),
  });
}

export interface CheckoutStatus {
  id: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "FAILED" | string;
  transaction_id?: string | null;
  transaction_status?: string | null;
}

/** Real status, re-checked by SasPay with the operator (never trust a cached value). */
export const checkoutStatus = (sessionId: string) => call<CheckoutStatus>(`/checkout-sessions/${encodeURIComponent(sessionId)}/status/`);

export const isPaid = (s: CheckoutStatus) => s.status === "PAID" || s.transaction_status === "SUCCESS";
export const isDead = (s: CheckoutStatus) => ["CANCELLED", "EXPIRED", "FAILED"].includes(s.status) || s.transaction_status === "FAILED";

/** Webhook check: HMAC-SHA256 of "<timestamp>.<raw body>", at most 5 minutes old. */
export function verifyWebhook(rawBody: string, signature: string | null, timestamp: string | null) {
  const secret = process.env.SASPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !timestamp) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
