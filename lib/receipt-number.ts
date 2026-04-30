import { db } from "./db";

export async function generateReceiptNumber(date: Date = new Date()): Promise<string> {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const dayPrefix = `SC-${yyyy}-${mm}${dd}-`;

  const start = new Date(yyyy, date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(yyyy, date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);

  const count = await db.receipt.count({
    where: { createdAt: { gte: start, lt: end } },
  });

  const seq = String(count + 1).padStart(3, "0");
  return `${dayPrefix}${seq}`;
}
