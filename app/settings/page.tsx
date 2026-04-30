"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Field } from "@/components/Field";
import { PillToggle } from "@/components/PillToggle";

type Bank = {
  id: string;
  label: string;
  bankName: string | null;
  last4: string | null;
  acceptsZelle: boolean;
  acceptsWire: boolean;
};
type Seller = {
  id: string;
  name: string;
  defaultCommissionType: string | null;
  defaultCommissionValue: number | null;
};

export default function SettingsPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);

  async function refresh() {
    const [b, s] = await Promise.all([
      fetch("/api/banks").then((r) => r.json()),
      fetch("/api/sellers").then((r) => r.json()),
    ]);
    setBanks(b);
    setSellers(s);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="min-h-full pb-16">
      <TopNav active="settings" />
      <main className="max-w-3xl mx-auto px-4 pt-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Settings.
        </h1>

        <section className="mt-10">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted mb-4 border-b border-divider pb-2">
            Bank accounts
          </h2>
          <ul className="flex flex-col gap-2">
            {banks.map((b) => (
              <BankRow key={b.id} bank={b} onChange={refresh} />
            ))}
          </ul>
          <NewBank onCreated={refresh} />
        </section>

        <section className="mt-12">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted mb-4 border-b border-divider pb-2">
            Sellers
          </h2>
          <ul className="flex flex-col gap-2">
            {sellers.map((s) => (
              <SellerRow key={s.id} seller={s} onChange={refresh} />
            ))}
          </ul>
          <NewSeller onCreated={refresh} />
        </section>
      </main>
    </div>
  );
}

function BankRow({ bank, onChange }: { bank: Bank; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(bank.label);
  const [acceptsZelle, setAcceptsZelle] = useState(bank.acceptsZelle);
  const [acceptsWire, setAcceptsWire] = useState(bank.acceptsWire);

  async function save() {
    await fetch(`/api/banks/${bank.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, acceptsZelle, acceptsWire }),
    });
    setEditing(false);
    onChange();
  }
  async function remove() {
    if (!confirm(`Hide bank "${bank.label}"? Existing receipts keep their bank reference.`)) return;
    await fetch(`/api/banks/${bank.id}`, { method: "DELETE" });
    onChange();
  }

  if (!editing) {
    return (
      <li className="bg-card border border-divider rounded-lg px-4 py-3 flex justify-between items-center gap-3">
        <div className="min-w-0">
          <div className="text-ink truncate">{bank.label}</div>
          <div className="text-xs text-muted">
            {bank.acceptsZelle ? "Zelle · " : ""}
            {bank.acceptsWire ? "Wire" : ""}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="text-xs uppercase tracking-wider text-muted hover:text-ink"
          >
            Edit
          </button>
          <button
            onClick={remove}
            className="text-xs uppercase tracking-wider text-muted hover:text-warn"
          >
            Hide
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="bg-card border border-divider rounded-lg p-4 flex flex-col gap-3">
      <Field label="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={acceptsZelle}
            onChange={(e) => setAcceptsZelle(e.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          <span>Accepts Zelle</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={acceptsWire}
            onChange={(e) => setAcceptsWire(e.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          <span>Accepts Wire</span>
        </label>
      </div>
      <div className="flex gap-2 mt-1">
        <button
          onClick={save}
          className="bg-ink text-bg uppercase text-xs tracking-wider px-4 py-2 rounded-full"
        >
          Save
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-xs uppercase tracking-wider text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </li>
  );
}

function NewBank({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [acceptsZelle, setAcceptsZelle] = useState(true);
  const [acceptsWire, setAcceptsWire] = useState(true);

  async function create() {
    if (!label.trim()) return;
    await fetch("/api/banks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, acceptsZelle, acceptsWire }),
    });
    setLabel("");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-xs uppercase tracking-wider text-muted hover:text-ink"
      >
        + Add bank account
      </button>
    );
  }

  return (
    <div className="mt-3 bg-card border border-divider rounded-lg p-4 flex flex-col gap-3">
      <Field
        label="Label"
        placeholder="Chase ••1234"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={acceptsZelle}
            onChange={(e) => setAcceptsZelle(e.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          <span>Accepts Zelle</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={acceptsWire}
            onChange={(e) => setAcceptsWire(e.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          <span>Accepts Wire</span>
        </label>
      </div>
      <div className="flex gap-2 mt-1">
        <button
          onClick={create}
          className="bg-ink text-bg uppercase text-xs tracking-wider px-4 py-2 rounded-full"
        >
          Add
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs uppercase tracking-wider text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SellerRow({ seller, onChange }: { seller: Seller; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<"none" | "percent" | "flat">(
    (seller.defaultCommissionType as "percent" | "flat" | null) ?? "none",
  );
  const [value, setValue] = useState(
    seller.defaultCommissionValue != null ? String(seller.defaultCommissionValue) : "",
  );

  async function save() {
    await fetch(`/api/sellers/${seller.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        defaultCommissionType: type === "none" ? null : type,
        defaultCommissionValue: type === "none" || !value ? null : Number(value),
      }),
    });
    setEditing(false);
    onChange();
  }

  const summary =
    seller.defaultCommissionType && seller.defaultCommissionValue != null
      ? seller.defaultCommissionType === "percent"
        ? `${seller.defaultCommissionValue}% default`
        : `$${seller.defaultCommissionValue} flat default`
      : "No default commission";

  if (!editing) {
    return (
      <li className="bg-card border border-divider rounded-lg px-4 py-3 flex justify-between items-center gap-3">
        <div>
          <div className="text-ink">{seller.name}</div>
          <div className="text-xs text-muted">{summary}</div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs uppercase tracking-wider text-muted hover:text-ink"
        >
          Edit
        </button>
      </li>
    );
  }

  return (
    <li className="bg-card border border-divider rounded-lg p-4 flex flex-col gap-3">
      <div className="text-sm">{seller.name}</div>
      <div className="flex items-end gap-3 flex-wrap">
        <PillToggle
          value={type}
          options={[
            { value: "none", label: "None" },
            { value: "percent", label: "%" },
            { value: "flat", label: "$" },
          ]}
          onChange={(v) => setType(v)}
          size="sm"
          ariaLabel="Default commission"
        />
        {type !== "none" ? (
          <div className="flex-1 min-w-[140px]">
            <Field
              label={type === "percent" ? "Percent" : "Flat amount"}
              inputMode="decimal"
              prefix={type === "flat" ? "$" : ""}
              suffix={type === "percent" ? "%" : ""}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        ) : null}
      </div>
      <div className="flex gap-2 mt-1">
        <button
          onClick={save}
          className="bg-ink text-bg uppercase text-xs tracking-wider px-4 py-2 rounded-full"
        >
          Save
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-xs uppercase tracking-wider text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </li>
  );
}

function NewSeller({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function create() {
    if (!name.trim()) return;
    await fetch("/api/sellers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setName("");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-xs uppercase tracking-wider text-muted hover:text-ink"
      >
        + Add seller
      </button>
    );
  }

  return (
    <div className="mt-3 bg-card border border-divider rounded-lg p-4 flex flex-col gap-3">
      <Field
        label="Name"
        placeholder="First name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-2 mt-1">
        <button
          onClick={create}
          className="bg-ink text-bg uppercase text-xs tracking-wider px-4 py-2 rounded-full"
        >
          Add
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs uppercase tracking-wider text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
