# Live app: real accounts, real petitions, federal rules

Date: 2026-10-08 · Status: approved in chat (user asked to proceed without further check-ins)

## Intent

Move Swipe4Change from an offline demo to an app real people use at a public URL:

- real sign-in (Clerk) and real petitions that real users create and sign (Supabase);
- real-world civic actions pulled from an official US source;
- a public website anyone can open.

Decisions the user made: both user petitions and real-world ones; the US federal "open for
public comment" feed; fresh Supabase and Clerk projects; keep the demo only as an explicit
opt-in (`EXPO_PUBLIC_BACKEND=demo`); launch as a website on EAS Hosting; Clerk development
instance for now (no custom domain yet).

## What already exists

Hosted mode (Clerk + Supabase RPC adapter, RLS, Edge Functions) is implemented and is the
default backend. It has never run end to end on this machine: `.env` selects `demo` with
placeholder keys, and the September 30 project is abandoned. The gaps below are what stands
between that code and real users.

## 1. Fresh setup (`SETUP.md`)

A numbered checklist, linked from the README, replacing the notes about the old project.

User steps (their accounts): create a Clerk application (email + Google); set the session token
to `{"role":"authenticated","email_verified":"{{user.email_verified}}","name":"{{user.full_name}}"}`
(no email address: the database never needs it); create a Supabase project and add Clerk under
Authentication → Third-party auth; fill `.env`; run `npx supabase login` themselves.

Commands (scripted, run by Claude or the user): link, push migrations, deploy `ai-review` and
`civic-lookup`, set `ANTHROPIC_API_KEY` / `OPENSTATES_API_KEY` secrets from `.env`. The fictional
seed is never pushed to a live project.

## 2. Live-mode fixes

All server changes go in one migration, following the existing rename-and-wrap pattern
(`lookaware_snapshot` → `_v7`, `lookaware_command` → `_v10`).

**Claims sync.** The snapshot wrapper refreshes the caller's private record from their signed
Clerk token on every load: `email_verified` when the claim is present (absent claim leaves the
stored value alone), and the public profile name from `name` while it is still the placeholder
`Community member`. If anything changed it reloads, so a brand-new account sees its name on the
first load. Fixes: users who verify after first sign-in were stuck unverified forever, and every
account started as "Community member".

**Onboarding.** Adds a required display-name field (prefilled from the profile, blank if it is
still the placeholder) and a required checkbox: "I'm 13 or older and agree to the Terms and
Privacy Policy" (linking `/legal`). Name is saved through the existing `profile` command before
`onboard`. Applies in both modes; demo profiles already have names.

**`/legal` page.** Plain-language Terms and Privacy Policy describing what the app actually
stores (city and state, interests, display name, signatures with the chosen public identity,
on-device For You signals) and what it never stores (email in the database, exact location,
contact details shown to organizers). Marked for review by an adult or school adviser before
wide release.

**Delete account.** Profile → Delete account (live mode only; the demo already has reset). After
a typed confirmation the new `delete_account` command, in one transaction:

- deletes the caller's private and personal rows: Clerk mapping, interests, memberships, saves,
  drafts, signatures (and their receipts/referrals), volunteering, reports, post reports,
  eligibility requests, notifications, badges, ripple code, AI-lookup log;
- archives petitions they own (archived petitions are already out of public view);
- keeps public authored content (updates, edit history, discussion posts, deliveries,
  community ownership) attached to a profile renamed `Deleted account` with city/bio cleared.

The client first removes the user's own petition photos from Storage (the uploader-only delete
policy allows it), then runs the command, then deletes the Clerk user (`user.delete()`) and
returns Home. If the Clerk step fails, the next sign-in simply provisions a fresh empty profile.

**Hide demo content in live mode.** The fictional sample cities (Riverton, Brookside) are
offered and recognised only when `isDemo`; the fictional recipient directory is already gated
on them, so it disappears too. The `location` signing rule is not offered when creating or
editing a petition in live mode, because no real location verification exists.

## 3. Federal rules open for comment

Source: the Federal Register API (keyless, CORS `*`, official abstracts). It carries the same
proposed rules as Regulations.gov and its `comment_url` opens the Regulations.gov comment form,
so it satisfies the user's choice with less noise and no API key. Recorded in `DECISIONS.md`.

**No server, no table.** The app fetches open proposed rules (type `PRORULE`, comment period not
closed, `per_page=200`) with TanStack Query (1 h stale time).

**Pure module `src/domain/federal.ts`** (tested):

- Zod-parses each result; malformed items are dropped.
- Maps the most specific agency slug to an app topic: NHTSA / FHWA / FMCSA / FTA → Safer streets;
  EPA / Fish and Wildlife / NOAA / Energy → Environment; Education → Education; National Park
  Service / Forest Service / BLM → Public spaces; Access Board → Accessibility. Any title
  mentioning disability or accessibility → Accessibility. Unmapped agencies are dropped.
- Drops routine items by title: airworthiness directives, special conditions, airspace changes,
  state air-plan approvals ("Air Plan Approval", "Approval and Promulgation"), safety zones,
  drawbridge operations.
- Accepts only `https` links on `federalregister.gov` / `regulations.gov`.
- Sorts by the viewer's interests first, then soonest deadline.

**UI.** A "Federal rules open for comment" rail on Explore (all mapped topics, respecting the
topic filter) and on Home (the viewer's interests, top three). Cards show a "Federal rule · open
for comment" label, topic, agency, title, and days left. The section hides itself on fetch error
or when empty, so offline demo use is unaffected.

`app/federal/[id].tsx` (deep-linkable by document number) shows the official abstract labelled
as such, the agency, the deadline, and "Applies nationwide · run by the federal government, not
Swipe4Change". The primary button, "Comment on Regulations.gov" (or "Read on the Federal
Register" when the agency takes comments elsewhere), opens the link after the same
leaving-the-app confirmation used for donation links. No in-app signing, saving or AI summary.

## 4. Public website

EAS Hosting (the app already uses `web.output: "server"`; the dev-only `/api` routes refuse
production). Script `deploy:web` = `expo export --platform web && eas deploy --prod`. The user
runs `npx eas-cli login` once. Clerk development mode works on the `*.expo.app` URL; switching to
production later is configuration plus DNS, no code.

## Testing

- `tests/federal.test.ts`: mapping, filtering, URL validation, sorting.
- `scripts/test-database.ts`: claims sync (verification refresh, name prefill, absent claim
  leaves value), `delete_account` (personal rows gone, petitions archived, public content kept
  under `Deleted account`, no remaining reference outside the allowed authored-content tables).
- Existing suites keep passing; typecheck, lint, web export.
- Live end-to-end smoke (needs the user's new keys): sign up, onboard, publish, sign as a
  second user, delete account.

## Out of scope

Pagination, Clerk production instance, app-store builds, saving or ranking federal rules
server-side, in-app comment submission, location verification, push notifications.
