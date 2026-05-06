import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE = "https://api.mercury.com/api/v1";

type MercuryAccount = {
  id: string;
  name: string;
  nickname: string | null;
  kind: string;
  status: string;
};

type MercuryTransaction = {
  id: string;
  amount: number;
  counterpartyName: string | null;
  counterpartyNickname: string | null;
  bankDescription: string | null;
  externalMemo: string | null;
  note: string | null;
  kind: string;
  status: string;
  postedAt: string | null;
  createdAt: string;
};

// Real money-movement kinds (in OR out). Excludes noise: internal/treasury
// transfers between Joe's own accounts, fees, card spend, fee reversals.
// Direction is derived from the SIGN of `amount` on the client.
const RELEVANT_KINDS = new Set([
  "incomingDomesticWire",
  "incomingInternationalWire",
  "externalTransfer",
  "checkDeposit",
  "outgoingPayment",
]);

export async function GET() {
  const token = process.env.MERCURY_API_KEY;
  if (!token) {
    return NextResponse.json({ error: "MERCURY_API_KEY not set" }, { status: 503 });
  }

  const auth = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  try {
    const accRes = await fetch(`${BASE}/accounts`, { headers: auth, cache: "no-store" });
    if (!accRes.ok) {
      const text = await accRes.text();
      return NextResponse.json(
        { error: `Mercury /accounts ${accRes.status}: ${text}` },
        { status: 502 },
      );
    }
    const accountsBody = await accRes.json();
    const accounts: MercuryAccount[] = accountsBody.accounts ?? [];

    const collected: (MercuryTransaction & { accountId: string; accountName: string })[] = [];

    for (const acc of accounts) {
      try {
        const txRes = await fetch(
          `${BASE}/account/${acc.id}/transactions?limit=25`,
          { headers: auth, cache: "no-store" },
        );
        if (!txRes.ok) continue;
        const txBody = await txRes.json();
        const transactions: MercuryTransaction[] = txBody.transactions ?? [];
        for (const t of transactions) {
          if (
            t.amount !== 0 &&
            t.status === "sent" &&
            RELEVANT_KINDS.has(t.kind)
          ) {
            collected.push({
              ...t,
              accountId: acc.id,
              accountName: acc.nickname ?? acc.name,
            });
          }
        }
      } catch {
        // skip account on failure
      }
    }

    collected.sort((a, b) => {
      const ta = new Date(a.postedAt ?? a.createdAt).getTime();
      const tb = new Date(b.postedAt ?? b.createdAt).getTime();
      return tb - ta;
    });

    return NextResponse.json(collected.slice(0, 60));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
