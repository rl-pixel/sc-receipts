"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { Send, Image as ImageIcon, Pencil } from "lucide-react";
import { copy } from "@/lib/copy";
import { dollarsToCents, formatUSD } from "@/lib/money";

type Bank = { id: string; label: string; acceptsZelle: boolean; acceptsWire: boolean };
type Seller = { id: string; name: string };
type RecentCustomer = {
  id: string;
  name: string;
  email: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};
type RecentWatch = {
  brand: string;
  model: string;
  referenceNumber: string | null;
  count: number;
};

type Step = "amount" | "method" | "customer" | "watch" | "boxpapers" | "soldby" | "ready";

type Bubble =
  | { id: string; role: "bot"; text: string }
  | { id: string; role: "user"; text: string }
  | { id: string; role: "user"; image: string };

type State = {
  step: Step;
  amount: string;
  method: "Zelle" | "Wire" | "Other";
  methodOther: string;
  bankAccountId: string;
  customerName: string;
  customerEmail: string;
  brand: string;
  model: string;
  hasBox: boolean;
  hasPapers: boolean;
  soldBy: string;
};

const initial: State = {
  step: "amount",
  amount: "",
  method: "Zelle",
  methodOther: "",
  bankAccountId: "",
  customerName: "",
  customerEmail: "",
  brand: "",
  model: "",
  hasBox: true,
  hasPapers: true,
  soldBy: "Joe",
};

export function ChatReceipt({ onSwitchToManual }: { onSwitchToManual: () => void }) {
  const router = useRouter();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [state, setState] = useState<State>(initial);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);
  const [recentWatches, setRecentWatches] = useState<RecentWatch[]>([]);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial greeting (one time)
  useEffect(() => {
    setBubbles([{ id: crypto.randomUUID(), role: "bot", text: copy.greeting() }]);
  }, []);

  // Fetch banks + sellers + recents
  useEffect(() => {
    void Promise.all([
      fetch("/api/banks").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/sellers").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/recent").then((r) => (r.ok ? r.json() : { customers: [], watches: [] })),
    ]).then(([b, s, recent]) => {
      setBanks(b);
      setSellers(s);
      setRecentCustomers(recent.customers ?? []);
      setRecentWatches(recent.watches ?? []);
      if (b.length) {
        const zelle = b.find((x: Bank) => x.acceptsZelle);
        setState((st) => ({ ...st, bankAccountId: zelle?.id ?? b[0].id }));
      }
    });
  }, []);

  // Auto-scroll to bottom on new bubble
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, pendingImage]);

  function addBot(text: string) {
    setBubbles((b) => [...b, { id: crypto.randomUUID(), role: "bot", text }]);
  }
  function addUser(text: string) {
    setBubbles((b) => [...b, { id: crypto.randomUUID(), role: "user", text }]);
  }
  function addUserImage(url: string) {
    setBubbles((b) => [...b, { id: crypto.randomUUID(), role: "user", image: url }]);
  }

  // Advance to a step + ask the appropriate question
  function ask(step: Step) {
    setState((s) => ({ ...s, step }));
    setTimeout(() => {
      if (step === "amount") addBot(copy.askPayment());
      else if (step === "method") addBot(copy.askMethod());
      else if (step === "customer") addBot(copy.askCustomer());
      else if (step === "watch") addBot(copy.askWatch());
      else if (step === "boxpapers") addBot("Box and papers?");
      else if (step === "soldby") addBot(copy.askSeller());
      else if (step === "ready") addBot(copy.confirm());
    }, 250);
  }

  function handleImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setPendingImage(dataUrl);
      addUserImage(dataUrl);
      addBot(copy.screenshotAck());
      setTimeout(() => {
        addBot("Without the AI key wired up yet, I can't read it automatically — just type the amount + customer below and I'll log the screenshot too.");
        ask("amount");
      }, 600);
    };
    reader.readAsDataURL(file);
  }

  function handleSendText() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    addUser(text);

    // Heuristic parsing per step
    const next: Partial<State> = {};
    if (state.step === "amount") {
      const numberMatch = text.match(/[\d,]+(?:\.\d+)?/);
      if (numberMatch) {
        next.amount = numberMatch[0].replace(/,/g, "");
        setState((s) => ({ ...s, ...next }));
        ask("method");
      } else {
        setTimeout(() => addBot("Hmm, didn't catch a number. Try something like '4500' or '$4,500'."), 200);
      }
    } else if (state.step === "customer") {
      // pull email if present
      const emailMatch = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      const email = emailMatch?.[0] ?? "";
      const nameRaw = text.replace(email, "").replace(/[,;]/g, " ").trim();
      next.customerEmail = email;
      next.customerName = nameRaw || "";
      if (!email || !nameRaw) {
        setState((s) => ({ ...s, ...next }));
        setTimeout(() => addBot("Need both — name and email. Try 'Brian Hodge brian@email.com'."), 200);
      } else {
        setState((s) => ({ ...s, ...next }));
        ask("watch");
      }
    } else if (state.step === "watch") {
      const parts = text.split(/\s+/);
      next.brand = parts[0] ?? "";
      next.model = parts.slice(1).join(" ") || parts[0];
      setState((s) => ({ ...s, ...next }));
      ask("boxpapers");
    } else if (state.step === "method" && state.method === "Other") {
      next.methodOther = text;
      setState((s) => ({ ...s, ...next }));
      ask("customer");
    }
  }

  async function save() {
    setSubmitting(true);
    try {
      const subtotalCents = dollarsToCents(state.amount);
      const formPayload = {
        payment: {
          sender: state.customerName,
          amountUsd: state.amount,
          date: new Date().toISOString().slice(0, 10),
          confirmation: "",
          method: state.method,
          methodOther: state.methodOther,
          bankAccountId: state.bankAccountId,
        },
        customer: {
          name: state.customerName,
          email: state.customerEmail.toLowerCase(),
          phone: "",
          addressLines: "",
          street: "",
          city: "",
          state: "",
          zip: "",
        },
        watch: {
          brand: state.brand,
          model: state.model,
          referenceNumber: "",
          year: "",
          condition: "New",
          hasBox: state.hasBox,
          hasPapers: state.hasPapers,
          serial: "",
        },
        seller: {
          soldBy: state.soldBy,
          commissionType: null,
          commissionValue: "",
        },
        totals: { shippingUsd: "", taxUsd: "" },
        notes: "",
      };
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ form: formPayload }),
      });
      if (!res.ok) throw new Error("save failed");
      const created = await res.json();
      // Celebrate 🎉
      void confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#0052ff", "#00d924", "#ffc93c", "#ffffff"],
      });
      addBot(`${copy.saved()} — ${formatUSD(subtotalCents)} in the books.`);
      setTimeout(() => router.push(`/history/${created.id}?just_created=1`), 900);
    } catch {
      addBot(copy.error());
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-260px)] sm:h-[640px] bg-white border border-divider rounded-3xl overflow-hidden shadow-[0_2px_4px_rgba(15,23,42,0.03),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
      {/* Header strip */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-divider bg-gradient-to-r from-accent-soft/40 to-transparent">
        <div>
          <div className="text-base font-semibold text-ink">New receipt</div>
          <div className="text-xs text-muted">Type or drop a screenshot</div>
        </div>
        <button
          type="button"
          onClick={onSwitchToManual}
          className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-deep font-medium"
        >
          <Pencil size={14} /> Type it in
        </button>
      </div>

      {/* Bubbles */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {bubbles.map((b) =>
          b.role === "bot" ? (
            <BotBubble key={b.id}>{(b as { text: string }).text}</BotBubble>
          ) : "image" in b ? (
            <UserBubble key={b.id}>
              <img src={b.image} alt="" className="rounded-md max-h-48" />
            </UserBubble>
          ) : (
            <UserBubble key={b.id}>{(b as { text: string }).text}</UserBubble>
          ),
        )}

        {/* Inline pickers when needed */}
        {state.step === "method" && (
          <PickerRow>
            {(["Zelle", "Wire", "Other"] as const).map((m) => (
              <PickerChip
                key={m}
                onClick={() => {
                  setState((s) => ({
                    ...s,
                    method: m,
                    bankAccountId:
                      m === "Zelle"
                        ? banks.find((b) => b.acceptsZelle)?.id ?? s.bankAccountId
                        : m === "Wire"
                          ? banks.find((b) => b.acceptsWire && !b.acceptsZelle)?.id ?? s.bankAccountId
                          : s.bankAccountId,
                  }));
                  addUser(m);
                  if (m === "Other") {
                    setTimeout(() => addBot("Cool — what method? (Cash, Venmo, Check…)"), 200);
                  } else {
                    ask("customer");
                  }
                }}
              >
                {m}
              </PickerChip>
            ))}
          </PickerRow>
        )}

        {state.step === "customer" && recentCustomers.length > 0 && (
          <PickerRow>
            {recentCustomers.slice(0, 5).map((c) => (
              <PickerChip
                key={c.id}
                onClick={() => {
                  setState((st) => ({
                    ...st,
                    customerName: c.name,
                    customerEmail: c.email,
                  }));
                  addUser(c.name);
                  ask("watch");
                }}
              >
                {c.name}
              </PickerChip>
            ))}
          </PickerRow>
        )}

        {state.step === "watch" && recentWatches.length > 0 && (
          <PickerRow>
            {recentWatches.slice(0, 5).map((w, i) => (
              <PickerChip
                key={`${w.brand}-${w.model}-${i}`}
                onClick={() => {
                  setState((st) => ({ ...st, brand: w.brand, model: w.model }));
                  addUser(`${w.brand} ${w.model}`);
                  ask("boxpapers");
                }}
              >
                {w.brand} {w.model}
              </PickerChip>
            ))}
          </PickerRow>
        )}

        {state.step === "boxpapers" && (
          <PickerRow>
            {[
              { label: "Both", box: true, papers: true },
              { label: "Box only", box: true, papers: false },
              { label: "Papers only", box: false, papers: true },
              { label: "Neither", box: false, papers: false },
            ].map((opt) => (
              <PickerChip
                key={opt.label}
                onClick={() => {
                  setState((s) => ({ ...s, hasBox: opt.box, hasPapers: opt.papers }));
                  addUser(opt.label);
                  ask("soldby");
                }}
              >
                {opt.label}
              </PickerChip>
            ))}
          </PickerRow>
        )}

        {state.step === "soldby" && sellers.length > 0 && (
          <PickerRow>
            {sellers.map((s) => (
              <PickerChip
                key={s.id}
                onClick={() => {
                  setState((st) => ({ ...st, soldBy: s.name }));
                  addUser(s.name);
                  ask("ready");
                }}
              >
                {s.name}
              </PickerChip>
            ))}
          </PickerRow>
        )}

        {state.step === "ready" && (
          <div className="bg-divider-soft border border-divider rounded-xl p-4 text-sm text-ink flex flex-col gap-1">
            <div>
              <span className="text-muted">Customer:</span> {state.customerName} · {state.customerEmail}
            </div>
            <div>
              <span className="text-muted">Watch:</span> {state.brand} {state.model}
            </div>
            <div>
              <span className="text-muted">Amount:</span>{" "}
              <span className="nums">{formatUSD(dollarsToCents(state.amount))}</span> via{" "}
              {state.method === "Other" ? state.methodOther || "Other" : state.method}
            </div>
            <div>
              <span className="text-muted">Sold by:</span> {state.soldBy}
            </div>
            <button
              type="button"
              onClick={save}
              disabled={submitting}
              className="mt-3 bg-accent hover:bg-accent-deep text-white font-semibold text-base py-3 rounded-full disabled:opacity-40 transition-colors shadow-sm"
            >
              {submitting ? "Saving…" : "Save it 🚀"}
            </button>
          </div>
        )}
      </div>

      {/* Input area */}
      {state.step !== "ready" && (
        <div className="border-t border-divider bg-white p-3 flex items-end gap-2">
          <label className="cursor-pointer p-2 rounded-full hover:bg-divider-soft text-muted hover:text-ink transition-colors">
            <ImageIcon size={20} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImage(f);
                e.target.value = "";
              }}
            />
          </label>
          <input
            type="text"
            placeholder={
              state.step === "amount"
                ? "How much? e.g. $4,500"
                : state.step === "customer"
                  ? "Name + email"
                  : state.step === "watch"
                    ? "e.g. Rolex Submariner"
                    : "Type a reply…"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendText();
            }}
            className="flex-1 bg-divider-soft rounded-full px-4 py-2.5 text-base text-ink placeholder:text-muted-soft outline-none focus:ring-2 focus:ring-accent-soft"
          />
          <button
            type="button"
            onClick={handleSendText}
            disabled={!input.trim()}
            className="p-2.5 rounded-full bg-accent text-white disabled:opacity-30 transition-colors hover:bg-accent-deep"
          >
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function BotBubble({ children }: { children: ReactNode }) {
  return (
    <div className="self-start max-w-[85%] bg-divider-soft text-ink rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed animate-in fade-in slide-in-from-left-2 duration-300">
      {children}
    </div>
  );
}

function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="self-end max-w-[85%] bg-accent text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed animate-in fade-in slide-in-from-right-2 duration-300">
      {children}
    </div>
  );
}

function PickerRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2 self-start">{children}</div>;
}

function PickerChip({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white border border-divider hover:border-accent text-ink text-sm px-4 py-2 rounded-full transition-colors hover:bg-accent-soft"
    >
      {children}
    </button>
  );
}
