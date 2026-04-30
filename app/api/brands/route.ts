import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const brands = await db.brand.findMany({
      orderBy: [{ useCount: "desc" }, { name: "asc" }],
      take: 50,
    });
    return NextResponse.json(brands);
  } catch {
    return NextResponse.json([]);
  }
}
