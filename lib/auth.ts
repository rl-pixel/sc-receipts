// Machine-to-machine auth for ingest endpoints (Cowork agents posting orders,
// future Mercury reconciliation, etc.). Separate from the human-facing
// ADMIN_PASSWORD basic-auth gate in proxy.ts.

export type IngestAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function requireIngestKey(req: Request): IngestAuthResult {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) return { ok: true }; // dev mode — allow when unset
  const got = req.headers.get("x-ingest-key");
  if (!got || got !== expected) {
    return { ok: false, status: 401, error: "Missing or invalid X-Ingest-Key" };
  }
  return { ok: true };
}
