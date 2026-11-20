import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyHmacSha256(rawBody, signature, secret) {
  if (!secret || !signature || typeof signature !== "string") return false;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || "");
  const expected = createHmac("sha256", secret).update(raw).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(expected, received);
}

export function moneyToCents(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [units, fraction = ""] = text.split(".");
  const cents = Number(units) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function sameMoney(left, right) {
  const a = moneyToCents(left);
  const b = moneyToCents(right);
  return a !== null && b !== null && a === b;
}

export function tranzakEventKey(eventName, transactionId) {
  return `tranzak:${String(eventName || "").trim()}:${String(transactionId || "").trim()}`;
}
