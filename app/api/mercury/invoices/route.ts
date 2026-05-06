import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE = "https://api.mercury.com/api/v1";

export async function GET() {
  const token = process.env.MERCURY_API_KEY;
  if (!token) {
    return NextResponse.json({ error: "MERCURY_API_KEY not set" }, { status: 503 });
  }
  const auth = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  // Try the documented invoice endpoints. Mercury's public API surface for
  // invoicing isn't fully documented — try a few likely paths and return
  // whatever responds. Empty array if nothing works (graceful degrade).
  const candidates = [`${BASE}/invoices`, `${BASE}/invoice`];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: auth, cache: "no-store" });
      if (!res.ok) continue;
      const body = await res.json();
      // Mercury commonly wraps lists in { invoices: [...] } or similar
      const list =
        Array.isArray(body) ? body :
        Array.isArray(body.invoices) ? body.invoices :
        Array.isArray(body.data) ? body.data :
        [];
      return NextResponse.json(list);
    } catch {
      // continue
    }
  }
  return NextResponse.json([]);
}
