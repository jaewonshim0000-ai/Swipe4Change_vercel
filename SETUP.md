# Setting up the live app

This takes a fresh Clerk application and a fresh Supabase project to a public website real people
can sign up on. Steps marked **you** need your own accounts; nobody else should type your
passwords or secret keys. Everything else is a command you can run, or ask Claude to run.

Never put a Supabase secret/service-role key, a Clerk secret key, `ANTHROPIC_API_KEY` or
`OPENSTATES_API_KEY` in `.env` variables that start with `EXPO_PUBLIC_`, and never push
`supabase/seed.sql` (fictional data) to a live project.

## 1. Clerk (you)

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com) with **Email** and
   **Google** sign-in. Keep **verify email at sign-up** on.
2. **Configure → Sessions → Customize session token**, paste exactly:
   ```json
   {
     "role": "authenticated",
     "email_verified": "{{user.email_verified}}",
     "name": "{{user.full_name}}"
   }
   ```
   The email address is deliberately left out: the database never needs it. `email_verified`
   lets people publish; `name` fills in their display name the first time they sign in.
3. Profile → Delete account removes the Clerk user with the user's own session
   (`user.delete()`). If that step reports an error in testing, enable self-service account
   deletion for users in the Clerk dashboard's user settings.
4. Open [Connect with Supabase](https://dashboard.clerk.com/setup/supabase), choose this
   application, and copy the **Clerk domain** it shows (e.g. `your-app.clerk.accounts.dev`).
5. Copy the **publishable key** (`pk_test_…`) from **API keys**.

## 2. Supabase (you)

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Note the
   **project ref** (the `xxxx` in `https://xxxx.supabase.co`).
2. **Authentication → Sign In / Providers → Third-Party Auth → Add provider → Clerk**, paste the
   Clerk domain from step 1.4.
3. **Project Settings → API Keys**: copy the **publishable key** (`sb_publishable_…`).

## 3. Local configuration (you)

Copy `.env.example` to `.env` and fill in:

```sh
EXPO_PUBLIC_BACKEND=supabase
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…
```

## 4. Database and server functions

Log in once in **your own terminal** (it opens a browser):

```sh
npx supabase login
```

Then:

```sh
npx supabase link --project-ref xxxx
npm run supabase:push:preview   # lists the migrations that will run
npm run supabase:push
npx supabase functions deploy ai-review --no-verify-jwt
npx supabase functions deploy civic-lookup --no-verify-jwt
```

Set the server-only keys **in your own terminal**, so they never pass through chat or the app:

```sh
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-… OPENSTATES_API_KEY=…
```

`ai-review` must be deployed before anyone publishes: new petitions stay hidden as "checking"
until it has screened them. Without `ANTHROPIC_API_KEY` it falls back to keyword rules.

## 5. Try it locally

```sh
npm run web
```

Smoke test with two real accounts (two browsers, or a private window):

1. Sign up as person A, choose a name, tick the 13+ / Terms box, pick interests and a city.
2. Create and publish a petition. It shows "checking" for a few seconds, then goes public.
3. Sign up as person B, find the petition, sign it. A sees the count go up and gets a
   notification that shows only B's chosen public name.
4. Explore shows **Federal rules open for comment**; open one and check the Regulations.gov link.
5. As B, Profile → **Delete account**, type `DELETE`. B is signed out; A's petition loses B's
   signature; B's sign-in no longer works.

## 6. Publish the website (Vercel, you)

Before the first deploy, check the exact build Vercel will make, on your machine:

```sh
npm run preview:web
```

It builds the single-page web app as Vercel does and serves it at `http://localhost:4173`, with
the same fallback that makes links like `/petition/…` open directly. It uses the values in your
`.env`, so with step 3 done it talks to your real Supabase and Clerk.

Then, once, at [vercel.com](https://vercel.com):

1. **Add New → Project**, import the GitHub repository `jaewonshim0000-ai/Swipe4Change_vercel` (public). Vercel reads
   `vercel.json` (build `npx expo export --platform web`, output `dist`), so leave the framework
   preset as **Other** and change nothing else.
2. **Environment Variables** (all environments), the same public values as your `.env`:
   `EXPO_PUBLIC_BACKEND=supabase`, `EXPO_PUBLIC_SUPABASE_URL`,
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, and optionally
   `EXPO_PUBLIC_CONTACT_EMAIL` (shown publicly on the Terms page; use an address made for the
   app). **Never** add `ANTHROPIC_API_KEY`, `OPENSTATES_API_KEY` or any secret key here: anything
   in the web build is public. Those live only in Supabase (step 4).
3. **Deploy.** The site is at `https://<project>.vercel.app`. From then on every push to `main`
   redeploys it, and other branches get their own preview addresses. Changing an environment
   variable needs a redeploy (Deployments → ⋯ → Redeploy), because the values are built in.
4. Repeat the step 5 smoke test on the live address, and open a petition link in a fresh tab to
   check that deep links load directly.

### The beta, and leaving it

On a `vercel.app` address Clerk can only run its **development** instance: a development notice
on sign-in, at most **100 accounts**, and those accounts cannot move to a production instance.
The app says so in a **Beta** label, on the sign-in screen and on the Terms page.

To leave the beta: buy a domain (Vercel sells them, with DNS in the same dashboard), add it to the
Vercel project, create a Clerk **production** instance, add the DNS records Clerk lists, then
repeat steps 1.2–1.5 and 2.2 with the production values and update the Vercel variables. No code
changes. Beta accounts sign up again; their old rows stay in Supabase but no longer match a
sign-in.

### Free-tier limits worth knowing

- A free Supabase project **pauses after about a week without activity**; resume it from the
  dashboard, or move to a paid plan before promoting the app.
- Set a **monthly spending limit** on the Anthropic key: every publication and report is
  screened by Claude, and "Write it for me" and the recipient finder call it too.
- Vercel's free Hobby plan is for non-commercial projects, which this is.

## Before inviting people

- Have a parent, teacher or adviser read the Terms and Privacy page (`app/legal.tsx`).
- Petitions requiring **location** verification are not offered in the live app: no real
  residency check exists yet.
- Roles that need a trusted person (verifying official responses, reviewing reports and appeals,
  approving custom eligibility at scale) are not staffed. See "Scope and limitations" in the
  README.
