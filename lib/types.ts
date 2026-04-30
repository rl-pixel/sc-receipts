export type Condition = "New" | "Like New" | "Excellent" | "Very Good" | "Good";
export const CONDITIONS: Condition[] = ["New", "Like New", "Excellent", "Very Good", "Good"];

export type PaymentMethod = "Zelle" | "Wire" | "Venmo" | "CashApp" | "PayPal" | "Check" | "Other";
export const PAYMENT_METHODS: PaymentMethod[] = [
  "Zelle",
  "Wire",
  "Venmo",
  "CashApp",
  "PayPal",
  "Check",
  "Other",
];

export type CommissionType = "percent" | "flat";

export type FormState = {
  payment: {
    sender: string;
    amountUsd: string;
    date: string;
    confirmation: string;
    method: PaymentMethod;
    bankAccountId: string;
  };
  customer: {
    name: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  watch: {
    brand: string;
    model: string;
    referenceNumber: string;
    year: string;
    condition: Condition;
    hasBox: boolean;
    hasPapers: boolean;
    serial: string;
  };
  seller: {
    soldBy: string;
    commissionType: CommissionType | null;
    commissionValue: string;
  };
  totals: {
    shippingUsd: string;
    taxUsd: string;
  };
  notes: string;
};

export type ReceiptPdfData = {
  receiptNumber: string;
  issuedAt: string;
  business: {
    name: string;
    location: string;
    website: string;
    footer: string;
  };
  customer: {
    name: string;
    email: string;
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  watch: {
    brand: string;
    model: string;
    referenceNumber: string;
    year: string;
    condition: string;
    hasBox: boolean;
    hasPapers: boolean;
  };
  payment: {
    method: string;
    sender: string;
    confirmation: string;
    date: string;
  };
  totals: {
    subtotalCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
  };
};
