# Studio Chrono — Receipt Generator

Mobile-first tool to send a clean, branded receipt to a Studio Chrono customer in under 30 seconds. Built for Joe (iPhone) and Rachel (desktop). Tracks every sale — customer, watch, payment, bank account, seller, commission.

This is **Phase 1**: form, PDF, and history. Email automation (Resend) and OCR auto-fill from Zelle screenshots are coming in Phase 2.

---

## Quick start (local development)

You only need to do this once. From a Terminal:

```bash
cd studio-chrono-app
npm install
npm run db:migrate     # create the local database
npm run db:seed        # add Joe + Jacob, the two starter bank accounts, default brands
npm run dev            # start the app at http://localhost:3000
```

That's it. Open `http://localhost:3000` in your browser.

If `db:migrate` asks you to name a migration just hit Enter — it'll use a timestamp.

---

## How Joe uses it

1. **Sale comes in.** Customer Zelles or wires you the money.
2. Open the app on your phone (or save it to your home screen — looks like a real app).
3. Tap into each section and fill in:
   - **Payment** — sender name, amount, date, confirmation #, method
   - **Bank — deposited to** — tap which of your bank accounts received the funds
   - **Sold by** — tap Joe or Jacob (one tap)
   - **Commission** — None / % / $ — type the number, the dollar value calculates live
   - **Customer** — email, name, ship-to address
   - **Watch** — brand, model, ref #, year, condition, Box / Papers checkboxes, serial
   - **Totals** — shipping, tax (subtotal pulls from Payment automatically; total updates live)
4. Tap **Preview & Save Receipt**.
5. The app saves the sale and opens the receipt detail page with the PDF preview.
6. Tap **Download PDF** → attach it to your normal email and send to the customer.

> In Phase 2 (next iteration), tapping Save will email the customer the PDF automatically.

---

## What gets saved

Every sale is logged in `/history` with:

- Date, customer, watch, total
- Who sold it (Joe / Jacob)
- Which bank received the funds
- Commission paid out (if set)
- The PDF receipt (re-downloadable at any time)

You can search by customer name, ref #, model, or receipt number. Filter by Last 30 days / This month / brand.

---

## Settings

Go to `/settings` (top-right nav) to:

- **Add or edit bank accounts** — e.g., "Chase ••1234 (Zelle)", "BofA ••5678 (Wire only)". Mark each as accepts-Zelle / accepts-Wire so you remember which one to give the customer.
- **Set default commissions per seller** — optional. If Jacob always gets 10%, set it once and it pre-fills every receipt. Leave blank to type per-sale.
- **Add new sellers** — if your team grows beyond Joe + Jacob.

---

## Daily backup (very important!)

In local dev, the database is one file: `studio-chrono-app/prisma/dev.db`.
**Copy it somewhere safe regularly** (Dropbox, iCloud, an external drive). If the laptop dies or this folder gets deleted, that's your sale history.

In production (Vercel + Neon), backups happen automatically.

---

## Deploying to the web (production)

Once you're ready for Joe to use this from his phone in the wild:

### 1. Push the code to GitHub

```bash
cd studio-chrono-app
git remote add origin git@github.com:YOUR_USERNAME/studio-chrono-app.git
git push -u origin main
```

### 2. Create a free Vercel account

Go to [vercel.com](https://vercel.com), sign in with GitHub, and import this repo. Vercel will auto-detect Next.js and deploy.

### 3. Switch to Postgres

SQLite doesn't work on Vercel (the file gets wiped on every deploy). You need a hosted Postgres:

- Go to [neon.tech](https://neon.tech), sign up for the free tier, create a database called `studiochrono`.
- Copy the connection string they give you.
- In Vercel → your project → **Settings** → **Environment Variables**, set:
  - `DATABASE_URL` = the Neon connection string
  - `ADMIN_PASSWORD` = a long random password (this is what you'll type to access the app)
- Change `prisma/schema.prisma` line `provider = "sqlite"` to `provider = "postgresql"`.
- Locally run `npm run db:migrate` once with the Neon URL set, then push and redeploy.

### 4. Custom domain (optional)

If you own `studiochrono.com`, you can point a subdomain like `receipts.studiochrono.com` at this Vercel project — go to Vercel → **Settings** → **Domains** and follow the DNS instructions.

---

## Phase 2 — automatic email + Zelle screenshot OCR

Once Joe has used Phase 1 a few weeks and you want the magic, set up:

### Resend (transactional email)

1. Sign up free at [resend.com](https://resend.com).
2. Add `studiochrono.com` as a sending domain — Resend gives you 3 DNS records to add to your domain registrar.
3. Wait for verification (usually under 10 minutes).
4. Create an API key, paste it into `RESEND_API_KEY` in your env vars.
5. Set `RESEND_FROM=receipts@studiochrono.com` and `RESEND_REPLY_TO=joe@yourgmail.com`.

The "Send" button on the receipt detail page will then automatically email the customer the PDF.

### Anthropic Claude Vision (OCR)

1. Sign up at [console.anthropic.com](https://console.anthropic.com), fund $5.
2. Create an API key, paste into `ANTHROPIC_API_KEY` in your env vars.

The form will get an upload zone — drop a Zelle screenshot, the form auto-fills sender, amount, date, and confirmation #.

---

## Troubleshooting

**"Cannot find module '@prisma/client'"**
Run `npx prisma generate`.

**Database is empty / brand-new install**
Run `npm run db:seed`.

**Want a fresh database?**
`npm run db:reset` — wipes the db, re-runs migrations, re-seeds. **Caution:** deletes all your sales history.

**Forgot the admin password?**
Open Vercel → Environment Variables, change `ADMIN_PASSWORD`, redeploy.

**The PDF looks generic (Helvetica, not the brand fonts)**
Phase 1 uses Helvetica in the PDF for simplicity. Phase 2 will register DM Sans + Inter for pixel-perfect brand match. The web app already shows the right fonts.

---

## File map

```
studio-chrono-app/
├── app/
│   ├── page.tsx                      # / — the form
│   ├── history/page.tsx              # /history — sales list with filters
│   ├── history/[id]/page.tsx         # /history/[id] — receipt detail + PDF
│   ├── settings/page.tsx             # /settings — banks + sellers
│   ├── api/                          # JSON endpoints
│   │   ├── receipts/route.ts         # POST = create, GET = list
│   │   ├── receipts/[id]/route.ts    # GET, DELETE
│   │   ├── receipts/[id]/pdf/route.tsx  # streams the PDF
│   │   ├── banks/...                 # CRUD
│   │   ├── sellers/...               # CRUD
│   │   ├── customers/search/route.ts
│   │   └── brands/route.ts
│   ├── globals.css                   # Tailwind theme tokens
│   └── layout.tsx                    # fonts + root layout
├── components/
│   ├── ReceiptPdf.tsx                # the white invoice PDF
│   ├── PillToggle.tsx                # one-tap segmented buttons
│   ├── Field.tsx                     # labeled inputs
│   ├── Section.tsx                   # form section header
│   ├── Wordmark.tsx                  # STUDIO CHRONO wordmark (DM Sans)
│   └── TopNav.tsx
├── lib/
│   ├── db.ts                         # Prisma client (with better-sqlite3 adapter)
│   ├── money.ts                      # cents <-> dollars helpers
│   ├── receipt-number.ts             # SC-YYYY-MMDD-### generator
│   ├── commission.ts                 # % or $ → cents resolver
│   ├── form-state.ts                 # localStorage save/load
│   └── types.ts                      # shared TypeScript types
├── prisma/
│   ├── schema.prisma                 # data model
│   ├── seed.ts                       # initial data: Joe, Jacob, default banks
│   └── migrations/                   # auto-generated migration history
├── proxy.ts                          # basic-auth gate (was middleware.ts in older Next)
├── .env.example                      # copy to .env, fill in values
└── package.json
```
