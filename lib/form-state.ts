import type { FormState } from "./types";

export const STORAGE_KEY = "studiochrono.form.v2";

export function emptyForm(): FormState {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return {
    payment: {
      sender: "",
      amountUsd: "",
      date: `${yyyy}-${mm}-${dd}`,
      confirmation: "",
      method: "Zelle",
      methodOther: "",
      bankAccountId: "",
    },
    customer: {
      name: "",
      email: "",
      phone: "",
      addressLines: "",
      street: "",
      city: "",
      state: "",
      zip: "",
    },
    watch: {
      brand: "",
      model: "",
      referenceNumber: "",
      year: "",
      condition: "New",
      hasBox: true,
      hasPapers: true,
      serial: "",
    },
    seller: {
      soldBy: "Joe",
      commissionType: null,
      commissionValue: "",
    },
    totals: {
      shippingUsd: "",
      taxUsd: "",
    },
    notes: "",
  };
}

export function loadForm(): FormState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FormState>;
    const empty = emptyForm();
    return {
      payment: { ...empty.payment, ...(parsed.payment ?? {}) },
      customer: { ...empty.customer, ...(parsed.customer ?? {}) },
      watch: { ...empty.watch, ...(parsed.watch ?? {}) },
      seller: { ...empty.seller, ...(parsed.seller ?? {}) },
      totals: { ...empty.totals, ...(parsed.totals ?? {}) },
      notes: parsed.notes ?? "",
    };
  } catch {
    return null;
  }
}

export function saveForm(form: FormState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  } catch {
    // ignore quota errors
  }
}

export function clearForm(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
