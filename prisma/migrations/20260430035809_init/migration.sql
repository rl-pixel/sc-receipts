-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT DEFAULT 'USA',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "year" INTEGER,
    "condition" TEXT NOT NULL,
    "hasBox" BOOLEAN NOT NULL DEFAULT false,
    "hasPapers" BOOLEAN NOT NULL DEFAULT false,
    "serial" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Zelle',
    "paymentSender" TEXT,
    "paymentConfirmation" TEXT,
    "paymentDate" DATETIME NOT NULL,
    "paymentScreenshotUrl" TEXT,
    "bankAccountId" TEXT,
    "soldBy" TEXT NOT NULL,
    "commissionType" TEXT,
    "commissionValue" REAL,
    "commissionAmountCents" INTEGER,
    "sentAt" DATETIME,
    "sentToEmail" TEXT,
    "pdfUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Receipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Receipt_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "bankName" TEXT,
    "last4" TEXT,
    "acceptsZelle" BOOLEAN NOT NULL DEFAULT false,
    "acceptsWire" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Seller" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "defaultCommissionType" TEXT,
    "defaultCommissionValue" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "Receipt_createdAt_idx" ON "Receipt"("createdAt");

-- CreateIndex
CREATE INDEX "Receipt_customerId_idx" ON "Receipt"("customerId");

-- CreateIndex
CREATE INDEX "Receipt_soldBy_idx" ON "Receipt"("soldBy");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_name_key" ON "Seller"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");
