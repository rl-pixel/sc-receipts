export type Condition = "New" | "Like new";
export const CONDITIONS: Condition[] = ["New", "Like new"];

export type PaymentMethod = "Zelle" | "Wire" | "Other";
export const PAYMENT_METHODS: PaymentMethod[] = ["Zelle", "Wire", "Other"];

export type CommissionType = "percent" | "flat";

export type FormState = {
  payment: {
    sender: string;
    amountUsd: string;
    date: string;
    confirmation: string;
    method: PaymentMethod;
    methodOther: string;
    bankAccountId: string;
  };
  customer: {
    name: string;
    email: string;
    phone: string;
    addressLines: string;
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
  soldBy: string;
  business: {
    name: string;
    location: string;
    website: string;
  };
  customer: {
    name: string;
    email: string;
    addressLines: string;
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

export type RecentWatch = {
  brand: string;
  model: string;
  referenceNumber: string | null;
  year: number | null;
  condition: string;
  hasBox: boolean;
  hasPapers: boolean;
  count: number;
};

export type RecentCustomer = {
  id: string;
  name: string;
  email: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lastSoldAt: string | null;
};
