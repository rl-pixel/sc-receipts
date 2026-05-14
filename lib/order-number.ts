import { randomBytes } from "node:crypto";
import { db } from "./db";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomCode(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function generateOrderNumber(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = `SC-O-${randomCode(6)}`;
    const existing = await db.order.findUnique({ where: { orderNumber: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate unique order number");
}
