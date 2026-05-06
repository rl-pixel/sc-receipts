import { NextResponse } from "next/server";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";

const PROMPT = `You are extracting payment + customer details from a screenshot or PDF of a Mercury bank document, a Zelle confirmation, a wire confirmation, or an invoice. Return ONLY a JSON object with these exact fields. Use null for any field you cannot read clearly.

{
  "sender_name": string | null,
  "customer_name": string | null,
  "customer_email": string | null,
  "customer_phone": string | null,
  "customer_address": string | null,
  "amount_usd": number | null,
  "date_iso": string | null,
  "confirmation_number": string | null,
  "payment_method": "Zelle" | "Wire" | "ACH" | "Other" | null,
  "memo": string | null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- amount_usd is just the number, no $ or commas.
- date_iso is YYYY-MM-DD.
- customer_name and sender_name may be the same person — if only one is visible, set both to that value.
- customer_address is the full multi-line address if visible.
- Do NOT include any text outside the JSON.`;

export async function POST(request: Request) {
  const gemini = getGemini();
  if (!gemini) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set in env" },
      { status: 503 },
    );
  }

  let body: { mimeType?: string; dataBase64?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.mimeType || !body.dataBase64) {
    return NextResponse.json(
      { error: "Need { mimeType, dataBase64 }" },
      { status: 400 },
    );
  }

  try {
    const result = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: body.mimeType, data: body.dataBase64 } },
            { text: PROMPT },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });
    const text = result.text ?? "";
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Extraction failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
