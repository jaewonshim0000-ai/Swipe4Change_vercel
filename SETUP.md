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

## 6. Publish the website (EAS Hosting)

Once, in your own terminal:

```sh
npx eas-cli@latest login
npx eas-cli@latest init
```

Then, whenever you want to publish the current code:

```sh
npm run deploy:web
```

It exports the web build with the public values from `.env` and deploys it to a free
`https://<name>.expo.app` address. The development-only `/api` routes refuse to run there; the
live app uses the Supabase Edge Functions instead.

Clerk **development** mode works on that address but shows a "Development mode" badge and allows
about 100 users. For a real launch, buy a domain, create a Clerk **production** instance, add the
DNS records Clerk lists, then repeat steps 1.2–1.5 and 2.2 with the production values. No code
changes are needed.

## Before inviting people

- Have a parent, teacher or adviser read the Terms and Privacy page (`app/legal.tsx`).
- Petitions requiring **location** verification are not offered in the live app: no real
  residency check exists yet.
- Roles that need a trusted person (verifying official responses, reviewing reports and appeals,
  approving custom eligibility at scale) are not staffed. See "Scope and limitations" in the
  README.
