import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE = "https://api.mercury.com/api/v1";

export async function GET(request: Request) {
  const token = process.env.MERCURY_API_KEY;
  if (!token) {
    return NextResponse.json({ error: "MERCURY_API_KEY not set" }, { status: 503 });
  }
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  const id = url.searchParams.get("id");
  if (!accountId || !id) {
    return NextResponse.json(
      { error: "Need ?accountId=...&id=..." },
      { status: 400 },
    );
  }
  try {
    const res = await fetch(
      `${BASE}/account/${encodeURIComponent(accountId)}/transaction/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Mercury ${res.status}: ${body}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
