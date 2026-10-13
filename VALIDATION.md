# Validation record

Validated September 4–5, 2026 on the local development machine.

## Automated checks

- Prettier formatting check: passed.
- Expo ESLint: passed with no lint findings.
- Strict TypeScript: passed.
- Jest / React Native Testing Library: 20 tests across 3 suites passed.
- Embedded PostgreSQL integration: migration and repeated seed passed; all 19 exposed tables have RLS. Exercised anonymous access, profile isolation, direct-write denial, private drafts, creation/publication, anonymous signatures, duplicate prevention, immutable signing rules, missing email approval, custom review, organizer permissions, null-input rejection, and report isolation.
- Expo Doctor: all 21 checks passed. Expo-managed dependencies match the SDK.
- Expo web production export: passed.
- iOS and Android JavaScript / Hermes exports: both passed. These are bundle validations, not executed device builds.

## Browser walkthrough

Used a real Chromium browser at desktop (1440 × 1100) and phone (390 × 844) widths.

1. Signed into Maya's fictional account and completed onboarding.
2. Signed the flagship email-eligibility petition with Anonymous selected. Observed 684 → 685 signatures, disabled duplicate signing, and the public name Anonymous supporter.
3. Created an original campus-lighting petition, applied the deterministic title/summary suggestions, chose email eligibility with anonymous public identity allowed, previewed, and confirmed publication.
4. Posted an organizer update and verified confirmation.
5. Switched to Sam, completed onboarding, loaded the newly published petition, and signed anonymously.
6. Added a structured petition discussion contribution.
7. Joined Riverton students and posted a community contribution.
8. Verified the new petition remained searchable after page reload and account switching. Search with an unmatched term showed the empty state; “bus shelter” returned the new petition.
9. Checked phone layout and measured document width equal to viewport width (390px), without horizontal overflow. Adjusted the heading/action layout and tab labels after visual inspection.
10. The latest browser session reported zero console errors and zero warnings. Initial development warnings found during implementation were fixed.

Screenshots from this workspace run are saved under `output/playwright/` (ignored by Git). They include desktop Home, phone Home, and phone onboarding.

## Boundaries

No external Clerk or Supabase credentials were supplied. Hosted SQL behavior was tested with PostgreSQL, while live provider JWT configuration and hosted sign-in require staging validation. Xcode simulator tooling was unavailable; no native device execution, app-store submission, or EAS signing/build was claimed. The README provides those setup steps and the remaining production limitations.

## September 10 extension validation

- Strict typecheck and Expo lint passed for the discovery, draft, profile and encrypted vault changes.
- All 34 tests in 5 Jest suites passed. Additional coverage includes history weights and opt-out, recipient/writing support, incomplete draft persistence and cross-account isolation, profile validation, earned awards, ciphertext exclusion from snapshots, actual AES-GCM round trips using WebCrypto, nonce uniqueness, wrong keys, tampering, and wrong-owner authenticated data.
- Embedded PostgreSQL ran all migrations in filename order and the repeated seed. All 20 exposed tables have RLS. New checks cover private draft CRUD, publication cleanup, revoked legacy RPC execution, profile editing, trusted badge grants, private encrypted vault ownership and deletion, and rejection of plaintext fields in encrypted envelopes.
- `npx expo export --platform all` produced web, iOS and Android bundles successfully. These are bundle checks, not native device execution. A final web export follows the small layout adjustments.
- Browser drags across both the artwork and title/body now pass a card on a left swipe; Undo restores it; a right swipe opens review without signing. A regression component test checks pass, undo, and review without signature mutation. Web text selection is disabled on the swipe surface to keep dragging reliable.
- The exported production web app was served locally for a real browser walkthrough: incomplete draft save → Profile → resume → complete → preview → publish → sign → confirm. Publication removed the saved draft and awarded Change starter; signing awarded First voice.
- Browser verification used Expo Crypto itself: generated a recovery key, drew a fictional signature with the mouse, encrypted and saved it, rejected a wrong key, decrypted correctly, locked, then deleted the vault. The recovery key was not logged or saved in test artifacts.
- Profile bio, avatar, accent color, and history preference saved; the bio and chosen appearance persisted after reload. Screenshots cover mobile Home/Profile and desktop Home in `output/playwright/`.
- The production browser reported no application console errors or warnings. Chromium emitted only verbose diagnostics about password fields outside HTML forms. The development server was stopped after its earlier animation/deprecation warnings were fixed in app code.

## Legal records validation (September 10)

- 38 Jest/RNTL tests pass. Added immutable disclosure, missing/stale consent rejection, private receipts, owner and document binding for encryption, legal-setup locking, private affidavits, and threshold separation.
- PostgreSQL integration applies all migrations and repeats the seed. All 21 exposed tables have RLS; private vault/receipt/affidavit/review tables deny app-role access. The complete fictional review sequence tests prerequisites, app-role denial, atomic rollback, unchanged consent, and one accepted signature remaining below the exact threshold of two.
- Production web walkthrough at 390 × 844: create a fictional vault, draw/encrypt a signature, unlock in the full-text consent form, submit a receipt, read the signed text, then submit a pending circulator affidavit with encrypted document references. Legal acceptance remained zero.
- Expo exports produced web, iOS and Android bundles. Browser console contained no application errors during the legal walkthrough; Chrome emitted informational password-field/form notices.

**External validation still required:** real native-device encryption/accessibility, hosted Clerk/Supabase JWT configuration, voter-roll and signature review, applicable jurisdictional rules, notarization and authority filing. SQL acceptance tests simulate these reviews using explicitly fictional evidence; they do not establish real legal validity.

- Desktop browser check at 1440 × 1000: submitted the legal-requirements editor through its confirmation dialog; the result stayed pending and preserved history. Deleting the fictional vault did not remove prior receipts/affidavits.
- Applied Expo’s recommended compatible patch versions: Expo 57.0.21 and Expo Router 57.0.20.

## September 12 feedback-loop validation

- Prettier, Expo ESLint, and strict TypeScript passed.
- All 57 tests across 8 Jest suites passed. Three new suites cover notification fan-out (organizer, follower, milestone, eligibility decision, and the guarantee that an anonymous signer is never named to the organizer), full-field petition revision with locked audience and rule fields, signature withdrawal and re-signing, rolling seven-day velocity under a fake clock, community creation and moderator appointment, post tombstones, archival ordering, and report withdrawal.
- Embedded PostgreSQL integration passed, now also exercising the same behavior through the real SQL: notification fan-out to savers who never signed, revision of recipient/goal/evidence with prior wording preserved, rejection of an empty patch and a past deadline, community creation and moderator appointment restricted to actual members, community post tombstones, signature withdrawal deleting the private receipt, owner-only archival after a public close, and report withdrawal by its author only.
- Expo web production export passed.
- Browser walkthrough on the running web app: created a community (owner + first member, headcount labeled with no fictional padding), appointed moderators, revised a published petition's recipient and goal through the new patch editor with a before/after confirmation and reset form, and confirmed the loop end to end — Sam saved a petition without signing, Maya posted an organizer update, and Sam's notification screen showed it.

One regression was caught by the existing test suite during this work and fixed: the new private signing timestamp was leaking into the public signature projection, which would have let anyone correlate an anonymous supporter with whoever was active at that moment.

## 2026-09-23 — Trim and Ripple

- Removed: signature vault and encryption, legal qualification records, circulator affidavits and trusted-review functions, polls, proposals, task boards, shared documents, the request-to-response comparison, the separate follow command, and the emoji avatar/accent. Kept and simplified: the drawn signature, now drawn on the signing sheet itself.
- Prettier, Expo ESLint and strict TypeScript passed.
- All 91 tests across 16 Jest suites passed, including a new `tests/ripple.test.ts` (direct and further counts, loop safety, self-links, links from non-signers, unknown codes, withdrawal, anonymity of the notification, guest snapshot) and a rewritten signing-journey test that requires a drawing as well as consent.
- Embedded PostgreSQL integration passed against 23 RLS-protected tables, including the recursive ripple query, private referral and code tables that deny app-role reads, codes that are not profile ids and not visible to other accounts, and receipts that return the drawing only to its signer.
- Expo web production export passed.
- Browser walkthrough at 375 × 812: Maya read, chose a public name, drew a signature and confirmed; shared her ripple link; Sam opened it, navigated away and back, and signed without the link in the URL; Maya's bell showed "Your ripple grew" without naming Sam, and the ripple appeared on the petition page, Profile and Manage. No console errors.

One real bug surfaced in the browser: the signature pad appended each point to the list from the last render, so touch moves arriving between renders were dropped and strokes came out choppy. The pad now takes a state setter and appends functionally.

## 2026-10-12 — Final merge, design pass, haptics and poster

- Merged the live-accounts, community-backing and badges/notifications branches, and chained their wrapper migrations (`command_v10`–`_v12`, `snapshot_v7`–`_v8`).
- Prettier, Expo ESLint and strict TypeScript passed. All 200 tests across 41 Jest suites passed, including the new `design-tokens`, `swipe` and `poster` suites. The swipe suite was run against a deliberately broken tick rule and failed, as it should.
- Embedded PostgreSQL integration passed against 24 RLS tables, now also checking that account deletion removes private backing votes.
- Expo web production export passed.
- Headless Chromium walk-through at 375 × 812, 375 × 2400 and 1280 × 900 of Home, Explore, Create, Communities, Profile, petition, community, Manage, notifications, recipients, packet, signing sheet and poster, with no application console errors. (The offline demo logs 503s from `/api/ai` when no `ANTHROPIC_API_KEY` is set; the keyword fallback handles them.)
- On the web, a quick 50-point flick commits and a slow 50-point drag springs back. The poster's on-screen and printed QR codes both decode (jsQR) to the exact petition link.
- `npx expo install --check` lists newer SDK 57 patch releases (expo 57.0.28, expo-router 57.0.26 and 12 others). They were not applied in this pass.
