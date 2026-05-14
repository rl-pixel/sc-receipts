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

  await seedSampleOrders();

  console.log("Seeded sellers, banks, brands, settings, and sample orders.");
}

async function seedSampleOrders() {
  if ((await db.order.count()) > 0) return;

  const jacob = await db.seller.findUnique({ where: { name: "Jacob" } });

  const customers = [
    {
      email: "ari.weisman@example.com",
      name: "Ari Weisman",
      phone: "+1 305 555 1010",
      street: "100 Brickell Ave",
      city: "Miami",
      state: "FL",
      zip: "33131",
    },
    {
      email: "bill.bell@jeffries.example.com",
      name: "Bill Bell",
      phone: "+1 212 555 8800",
      street: "520 Madison Ave",
      city: "New York",
      state: "NY",
      zip: "10022",
    },
    {
      email: "dovid.k@example.com",
      name: "Dovid Klein",
      phone: "+1 732 555 2233",
      street: "12 Forest Ave",
      city: "Lakewood",
      state: "NJ",
      zip: "08701",
    },
  ];

  const customerIds: string[] = [];
  for (const c of customers) {
    const upserted = await db.customer.upsert({
      where: { email: c.email },
      update: {},
      create: c,
    });
    customerIds.push(upserted.id);
  }

  const samples: {
    externalOrderId: string;
    customerIdx: number;
    brand: string;
    model: string;
    referenceNumber: string;
    saleCents: number;
    c24FeeCents: number;
    status: "PENDING" | "PAID" | "PICKED" | "SHIPPED" | "DELIVERED";
    priorityFlag?: boolean;
    daysAgo: number;
  }[] = [
    {
      externalOrderId: "TC-12781001",
      customerIdx: 0,
      brand: "Rolex",
      model: "GMT-Master II",
      referenceNumber: "126710BLNR",
      saleCents: 1850000,
      c24FeeCents: 92500,
      status: "PAID",
      daysAgo: 2,
    },
    {
      externalOrderId: "TC-12781002",
      customerIdx: 1,
      brand: "Rolex",
      model: "Daytona",
      referenceNumber: "116500LN",
      saleCents: 4250000,
      c24FeeCents: 212500,
      status: "PENDING",
      priorityFlag: true,
      daysAgo: 0,
    },
    {
      externalOrderId: "TC-12781003",
      customerIdx: 2,
      brand: "Rolex",
      model: "Submariner Date",
      referenceNumber: "126610LN",
      saleCents: 1525000,
      c24FeeCents: 76250,
      status: "PICKED",
      daysAgo: 3,
    },
    {
      externalOrderId: "TC-12781004",
      customerIdx: 0,
      brand: "Rolex",
      model: "Datejust 41",
      referenceNumber: "126334",
      saleCents: 1175000,
      c24FeeCents: 58750,
      status: "SHIPPED",
      daysAgo: 5,
    },
    {
      externalOrderId: "TC-12781005",
      customerIdx: 1,
      brand: "Rolex",
      model: "Sky-Dweller",
      referenceNumber: "336934",
      saleCents: 2200000,
      c24FeeCents: 110000,
      status: "DELIVERED",
      daysAgo: 9,
    },
  ];

  for (const [i, s] of samples.entries()) {
    const created = new Date();
    created.setDate(created.getDate() - s.daysAgo);
    const escrow = new Date(created);
    escrow.setDate(escrow.getDate() + 7);

    const code = `SC-O-SEED${String(i + 1).padStart(2, "0")}`;
    const order = await db.order.create({
      data: {
        orderNumber: code,
        externalOrderId: s.externalOrderId,
        source: "CHRONO24",
        status: s.status,
        customerId: customerIds[s.customerIdx],
        brand: s.brand,
        model: s.model,
        referenceNumber: s.referenceNumber,
        condition: "New",
        hasBox: true,
        hasPapers: true,
        saleCents: s.saleCents,
        c24FeeCents: s.c24FeeCents,
        netToUsCents: s.saleCents - s.c24FeeCents,
        paymentMethod: "Chrono24Escrow",
        paymentConfirmedAt: s.status === "PENDING" ? null : created,
        escrowReleaseDate: escrow,
        assignedToSellerId: jacob?.id ?? null,
        priorityFlag: s.priorityFlag ?? false,
        pickedAt: ["PICKED", "SHIPPED", "DELIVERED"].includes(s.status) ? created : null,
        shippedAt: ["SHIPPED", "DELIVERED"].includes(s.status) ? created : null,
        deliveredAt: s.status === "DELIVERED" ? created : null,
        createdAt: created,
      },
    });
    await db.orderEvent.create({
      data: {
        orderId: order.id,
        type: "STATUS_CHANGED",
        toStatus: s.status,
        actor: "seed",
        message: `Sample seed (${s.status.toLowerCase()})`,
      },
    });

    await db.customer.update({
      where: { id: customerIds[s.customerIdx] },
      data: {
        source: "CHRONO24",
        firstOrderAt: created,
        lastOrderAt: created,
        totalOrders: { increment: 1 },
        totalSpentCents: { increment: s.saleCents },
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
