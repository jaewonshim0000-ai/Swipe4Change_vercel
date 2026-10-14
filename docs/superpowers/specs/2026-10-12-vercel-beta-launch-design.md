# Project A: public beta on Vercel

Date: 2026-10-12 · Status: section 1 approved in chat; the user asked to continue without further
check-ins, so sections 2–4 were decided by Claude and recorded here for review.

## Intent

Real people use Swipe4Change at a public website: real sign-up, real petitions, real
signatures. This is the first of four projects (A go live, B trust & safety console, C scale the
data layer, D launch polish); B and C must land before promoting it openly beyond the beta.

Decisions the user made: website first; eventual audience anyone in the US; host on **Vercel**
from the GitHub repo `Dankguy17/petitionv2`; use the free `*.vercel.app` address, no domain for
now; launch as a **public beta**; static single-page build.

Consequence of no domain: Clerk cannot run a production instance on `vercel.app`, so sign-in
uses a Clerk **development** instance: at most **100 accounts**, a development notice on sign-in,
and accounts cannot be moved to a production instance later. Beta accounts sign up again when a
domain and Clerk production arrive.

## 1. Build and hosting (approved)

- `app.config.ts` spreads `app.json` and sets `web.output` to `single` when `VERCEL=1`, otherwise
  `server`. Local `npm start` and the demo's development-only `/api` routes are unchanged.
- `vercel.json`: build `npx expo export --platform web`, output `dist`; rewrite every path that is
  not a file to `/index.html` (deep links work); immutable caching for `/_expo/static/*` and
  `/assets/*`.
- Deploys through Vercel's GitHub integration: `main` → production at `<project>.vercel.app`,
  other branches → preview URLs. No deploy tokens in the repo.
- Vercel environment variables are public values only: `EXPO_PUBLIC_BACKEND=supabase`,
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. `ANTHROPIC_API_KEY` and `OPENSTATES_API_KEY` exist only as
  Supabase Edge Function secrets.
- `npm run preview:web` builds exactly as Vercel does and serves it locally with the same
  single-page fallback.
- Risk to check first: single-page output with an `app/api` folder present. If Expo refuses it,
  exclude the development-only routes from the Vercel build; production never calls them.
- `deploy:web` (EAS Hosting) is removed; Vercel replaces it.

## 2. Backend setup (decided)

Unchanged from the October 8 live-app plan, so `SETUP.md` keeps its steps: a fresh Supabase
project with Clerk added as a third-party auth provider, all migrations pushed, `ai-review` and
`civic-lookup` deployed, secrets set by the user in their own terminal. The fictional seed is
never pushed. One Supabase project serves production and previews; previews are for the owner.

Free-tier notes recorded in `SETUP.md`: a free Supabase project pauses after a week without
activity (resume it from the dashboard, or upgrade before promoting); set a monthly spending
limit on the Anthropic key, since publication screening and report review call Claude.

## 3. Beta experience (decided)

- A **Beta** pill beside the Swipe4Change wordmark wherever it appears in live mode. Never in the
  demo, which is already labelled fictional.
- On the sign-in and sign-up screens in live mode, one line: "Public beta: open to the first 100
  accounts. Accounts may need to sign up again when the full version launches." Clerk's own
  component already shows its error when sign-up is refused, so no extra handling.
- The Terms and Privacy page says the same in its beta section, so the reset is disclosed before
  anyone signs up.
- An empty live site still has something to do: the Home deck already mixes in federal rules open
  for comment, and the existing empty states point to Create. No fictional content is added.

## 4. Verification (decided)

- Typecheck, lint, Jest, PostgreSQL integration test, and the Vercel-identical build.
- The single-page build served locally in demo mode: deep links (`/petition/<id>`,
  `/community/<id>`, `/poster/<id>`, `/legal`) load directly and on refresh, assets are cached,
  no console errors.
- After the user's account steps: the live smoke test from `SETUP.md` on the `vercel.app` URL
  with two real accounts.

## Out of scope

Custom domain and Clerk production (required before growing past 100 accounts), store apps,
project B (reviewer console), C (paged data layer), D (monitoring, link previews, rate limits,
legal review).

## Tasks

1. `app.config.ts`, `vercel.json`, `preview:web`; drop `deploy:web`; prove the single-page export
   and fix the `app/api` risk if it appears.
2. Beta pill, sign-in/up beta line, Terms beta section (live mode only), with tests.
3. `SETUP.md` §6 rewritten for Vercel plus free-tier notes; README, DECISIONS, FEATURES updated.
4. Verification as in §4; commit.
