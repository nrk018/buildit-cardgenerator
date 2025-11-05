# BUILD IT – Builder Card Generator

Next.js + TypeScript web app that generates PNG builder ID cards with embedded QR codes, stores member data in Supabase, provides an admin panel for adding members (single or CSV), and a verification page.

## Quick start

1) Create a Supabase project and a table named `builders` using the SQL below.

2) Copy `.env.local` with your keys:

```
NEXT_PUBLIC_SUPABASE_URL=YOUR_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON
```

3) Install and run:

```
pnpm i # or npm i / yarn
pnpm dev
```

Open `http://localhost:3000` for the generator and `/admin` for the admin panel.

## Database schema (Supabase SQL)

```sql
create table if not exists public.builders (
  id uuid primary key default gen_random_uuid(),
  builder_number integer not null unique,
  name text not null,
  registration_number text unique,
  email text,
  created_at timestamp with time zone not null default now(),
  downloaded_at timestamp with time zone,
  email_sent_at timestamp with time zone
);

-- Helpful index
create index if not exists builders_number_idx on public.builders(builder_number);

-- RLS
alter table public.builders enable row level security;
create policy "read builders" on public.builders for select using (true);
create policy "insert builders" on public.builders for insert with check (true);
```

If you prefer strict writes, restrict insert to service role and proxy writes via server functions instead of client-side routes.

## Features
- Card rendering via Canvas with gradient background and QR code
- PNG export (single download) and ZIP bulk export (admin)
- Auto-increment builder numbers when not provided
- CSV upload (columns: `name` and optional `builder_number` or `number`)
- Verification endpoint `/verify?builder=123` and API `/api/verify/[builder]`

## Card template/branding

This project draws a gradient background similar to the reference. If you have an official PNG template, place it in `public/branding/template.png` and you can extend `components/CardCanvas.tsx` to draw it under the gradient.

## Environment

### Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ADMIN_PASSWORD`

### Email Sending (choose one method)

#### Option 1: Resend (Recommended - Easiest)
Free tier: 3,000 emails/month, 100/day

**Quick Start (Testing):**
1. Sign up at https://resend.com
2. Get your API key from Dashboard → API Keys → Create API Key
3. Add to `.env.local`:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL="BUILD IT <onboarding@resend.dev>"
```
You can test immediately with `onboarding@resend.dev` (no domain verification needed).

**Production Setup (Verify Your Domain - builditmuj.club):**
1. In Resend Dashboard → Domains → Add Domain
2. Enter your domain: `builditmuj.club`
3. Resend will show DNS records to add:
   - **SPF record**: Add to your DNS (TXT record)
   - **DKIM records**: Add 2 CNAME records to your DNS
   - **DMARC record** (optional but recommended): Add TXT record
4. Add these records in your domain registrar (where you bought builditmuj.club)
5. Wait for verification (usually 5-15 minutes)
6. Once verified, update `.env.local`:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL="BUILD IT <noreply@builditmuj.club>"
```
Or use any email address with your domain: `contact@builditmuj.club`, `hello@builditmuj.club`, etc.

**Note:** If you want to use Gmail (`builditmuj.club@gmail.com` is not valid), use Gmail SMTP instead (see Option 2).

#### Option 2: SMTP (Gmail, SendGrid, etc.)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL="BUILD IT <your-email@gmail.com>"
```

**SMTP Providers:**
- **Gmail**: Use App Password (requires 2FA). Free but limited to ~500/day
- **SendGrid**: Free tier 100 emails/day. Get SMTP from Settings → API Keys → SMTP Relay
- **SMTP2GO**: Free tier 1,000 emails/month. Easy SMTP setup
- **Mailgun**: Free trial, then paid. Good for production

The app will try Resend first, then fall back to SMTP if Resend API key is not set.


