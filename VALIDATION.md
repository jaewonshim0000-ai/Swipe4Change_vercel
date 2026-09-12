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
