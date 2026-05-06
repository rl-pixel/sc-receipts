import { NextResponse } from "next/server";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";

const PROMPT = (refNumber: string) => `Identify the watch with reference number "${refNumber}". Return ONLY a JSON object:

{
  "brand": string,
  "model": string,
  "ref_confirmed": string,
  "year_introduced": number | null,
  "case_size_mm": number | null,
  "summary": string,
  "confidence": "high" | "medium" | "low"
}

Rules:
- "model" is the marketing/collection name only (e.g., "Submariner Date", "Daytona", "Moonswatch"), NOT including the brand.
- "ref_confirmed" echoes the reference number you matched (in case the user mistyped, you may correct OR keep as-is).
- "year_introduced" is the year that specific reference was launched, if known. null if unknown.
- "summary" is one sentence describing key features (dial, bezel, materials).
- If the reference is unknown / fictional, set confidence to "low" and best-guess the brand from any obvious prefix.
- Return ONLY the JSON, no surrounding text.`;

export async function POST(request: Request) {
  const gemini = getGemini();
  if (!gemini) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set in env" },
      { status: 503 },
    );
  }

  let body: { ref?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const ref = body.ref?.trim();
  if (!ref) {
    return NextResponse.json({ error: "Need { ref }" }, { status: 400 });
  }

  try {
    const result = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: PROMPT(ref) }] }],
      config: { responseMimeType: "application/json" },
    });
    const text = result.text ?? "";
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Lookup failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
