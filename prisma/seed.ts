import { config } from "dotenv";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

config();

const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL ?? "" }),
});

async function main() {
  for (const s of [
    { name: "Joe", sortOrder: 0 },
    { name: "Jacob", sortOrder: 1 },
  ]) {
    await db.seller.upsert({ where: { name: s.name }, update: {}, create: s });
  }

  await db.bankAccount.updateMany({
    where: { label: "Primary (Zelle)" },
    data: { label: "Zelle account", acceptsZelle: true, acceptsWire: false },
  });
  await db.bankAccount.updateMany({
    where: { label: "Wire Only" },
    data: { label: "Mercury", acceptsZelle: false, acceptsWire: true },
  });

  if ((await db.bankAccount.count()) === 0) {
    await db.bankAccount.create({
      data: { label: "Mercury", acceptsZelle: false, acceptsWire: true, sortOrder: 0 },
    });
    await db.bankAccount.create({
      data: { label: "Zelle account", acceptsZelle: true, acceptsWire: false, sortOrder: 1 },
    });
  }

  for (const name of ["Rolex", "Swatch", "Hamilton", "Omega"]) {
    await db.brand.upsert({ where: { name }, update: {}, create: { name } });
  }

  for (const s of [
    { key: "businessName", value: "Studio Chrono" },
    { key: "businessLocation", value: "Miami, FL" },
    { key: "businessWebsite", value: "studiochrono.com" },
  ]) {
    await db.appSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  console.log("Seeded sellers, banks, brands, and settings.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
