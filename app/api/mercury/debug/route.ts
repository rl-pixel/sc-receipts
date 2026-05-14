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
  kind: string;
  status: string;
  postedAt: string | null;
  createdAt: string;
};

// Diagnostic endpoint: shows exactly what Mercury is returning so we can
// figure out why the home feed might look empty. Returns raw counts by
// (kind, status, sign) plus sample transactions per account.
export async function GET() {
  const token = process.env.MERCURY_API_KEY;
  if (!token) {
    return NextResponse.json({ error: "MERCURY_API_KEY not set" }, { status: 503 });
  }

  const auth = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const accRes = await fetch(`${BASE}/accounts`, { headers: auth, cache: "no-store" });
  if (!accRes.ok) {
    return NextResponse.json(
      { error: `Mercury /accounts ${accRes.status}: ${await accRes.text()}` },
      { status: 502 },
    );
  }
  const accountsBody = await accRes.json();
  const accounts: MercuryAccount[] = accountsBody.accounts ?? [];

  const perAccount: Array<{
    accountId: string;
    accountName: string;
    kind: string;
    status: string;
    transactionsReturned: number;
    breakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
    incomingSamples: Array<{
      kind: string;
      status: string;
      amount: number;
      counterparty: string | null;
      postedAt: string | null;
      createdAt: string;
    }>;
  }> = [];

  for (const acc of accounts) {
    try {
      const txRes = await fetch(
        `${BASE}/account/${acc.id}/transactions?limit=500`,
        { headers: auth, cache: "no-store" },
      );
      if (!txRes.ok) {
        perAccount.push({
          accountId: acc.id,
          accountName: acc.nickname ?? acc.name,
          kind: acc.kind,
          status: acc.status,
          transactionsReturned: -1,
          breakdown: { _httpError: txRes.status },
          statusBreakdown: {},
          incomingSamples: [],
        });
        continue;
      }
      const txBody = await txRes.json();
      const transactions: MercuryTransaction[] = txBody.transactions ?? [];

      const breakdown: Record<string, number> = {};
      const statusBreakdown: Record<string, number> = {};
      const incomingSamples: Array<{
        kind: string;
        status: string;
        amount: number;
        counterparty: string | null;
        postedAt: string | null;
        createdAt: string;
      }> = [];

      for (const t of transactions) {
        const sign = t.amount > 0 ? "+" : t.amount < 0 ? "-" : "0";
        const k = `${t.kind} (${sign})`;
        breakdown[k] = (breakdown[k] ?? 0) + 1;
        statusBreakdown[t.status] = (statusBreakdown[t.status] ?? 0) + 1;
        if (t.amount > 0 && incomingSamples.length < 5) {
          incomingSamples.push({
            kind: t.kind,
            status: t.status,
            amount: t.amount,
            counterparty: t.counterpartyName ?? t.counterpartyNickname,
            postedAt: t.postedAt,
            createdAt: t.createdAt,
          });
        }
      }

      perAccount.push({
        accountId: acc.id,
        accountName: acc.nickname ?? acc.name,
        kind: acc.kind,
        status: acc.status,
        transactionsReturned: transactions.length,
        breakdown,
        statusBreakdown,
        incomingSamples,
      });
    } catch (err) {
      perAccount.push({
        accountId: acc.id,
        accountName: acc.nickname ?? acc.name,
        kind: acc.kind,
        status: acc.status,
        transactionsReturned: -1,
        breakdown: { _error: 1 },
        statusBreakdown: {},
        incomingSamples: [],
      });
      void err;
    }
  }

  return NextResponse.json({
    accountCount: accounts.length,
    perAccount,
  });
}
