import { randomBytes } from "node:crypto";
import { db } from "./db";

// Crockford-ish alphabet — no 0/O/1/I/L to avoid visual confusion.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomCode(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function generateReceiptNumber(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = `SC-${randomCode(6)}`;
    const existing = await db.receipt.findUnique({ where: { receiptNumber: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate unique receipt number");
}
