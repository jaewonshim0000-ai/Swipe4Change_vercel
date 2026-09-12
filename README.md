# Swipe4Change ↗

A mobile-first civic petition app for iOS, Android, and web. Notice something, understand the request, choose how to participate, and follow the next step.

**The default app is a complete, persistent local demo. No credentials are required.** Every account, community, organization, official response, source, and seed signature is fictional. The local adapter simulates eligibility; it does not verify real people. This is a competition prototype, not a deployed civic service.

The public app name is **Swipe4Change**. New native links use `swipe4change://`; the original `lookaware://` scheme remains an alias for existing links. Bundle/package IDs (`org.lookaware.app`), local storage/draft keys, and the existing migration/RPC names remain stable to preserve installed-app identity, saved demo data, and backend compatibility. Register `swipe4change://auth-callback` in Clerk before using native hosted sign-in with the renamed build. Rebuild native apps to pick up the display name and URL scheme.

## Run it

Use Node 22 LTS or newer (Node 26 also tested) and npm.

```sh
npm ci
npm run web
# Or run Metro for iOS / Android:
npm start
```

Choose Maya on the welcome screen, select at least three interests (or skip), enter a city/state, and continue. Data persists in AsyncStorage (browser local storage on web). Use Profile → Reset all local demo data to restore the community. No actual authentication secrets are stored in the demo.

- `npm run ios`: launch a configured iOS Simulator; requires macOS and Xcode.
- `npm run android`: launch a configured Android emulator or device; requires Android Studio.
- `npx eas-cli build --profile preview --platform all`: build installable previews after configuring your Expo account. `eas.json` includes preview, development, and production profiles.
- Native interfaces use React Native primitives, SafeAreaView, Expo Router, and dynamic text. Native binary execution requires device tooling; web export is the reproducible validation available without it.

Expo SDK **57**, React Native **0.86.3**, React **19.2.3**, strict TypeScript, Expo Router, Clerk, Supabase, TanStack Query, React Hook Form, Zod, Expo SecureStore, and a centralized StyleSheet system. Expo-managed dependencies are installed with `expo install`. See [Expo SDK 57](https://expo.dev/changelog/sdk-57) and [Clerk Expo documentation](https://clerk.com/docs/expo/getting-started/quickstart).

## Demo accounts

All three accounts are local simulations with no passwords:

| Account    | Purpose                                                                      | Private simulated approval            |
| ---------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| Maya Chen  | Student organizer; owns the flagship lighting petition and Riverton students | Email approved; location not approved |
| Sam Rivera | Neighbor; owns other sample petitions and two communities                    | Email and location approved           |
| Jordan Lee | New participant; useful for eligibility denial                               | Email and location not approved       |

Switch through Profile → Sign out / switch account. Each account has separate interests, memberships, saves, signatures, badges, and reports. There is no ability to impersonate these seed users in the hosted app.

## End-to-end smoke walkthrough

1. Enter as Maya, choose interests, and set `Riverton, CA`. Read **How your feed works**. Use topic chips, Trending, Explore search, Near me, and Saved.
2. Open **A brighter walk home starts here**. Inspect the requested action, source disclosure, update, edit history, community endorsement, milestones, and explicitly fictional verified response.
3. Profile → Private signature vault: create a **fictional** signatory record, draw a signature and save the recovery key privately. Return to the petition, choose **Anonymous**, unlock the vault, read the complete text, and explicitly consent. Progress and public supporters update; the public name is **Anonymous supporter**. A second signature is blocked. The profile receives a First voice badge.
4. Create → Safer walk template. Write a specific problem and action. Apply the **simulated AI** suggestion, undo it, or edit it. Continue and enter the recipient, summary, city, goal, future deadline, and optional labeled HTTPS evidence.
5. Choose `email` for private eligibility and allow `anonymous` publicly. Review the card and full text. Confirm publishing. The new petition appears in Home and Profile → Created. You can save incomplete drafts from any step and resume them from Profile. Previously created petition drafts remain publishable from Manage.
6. Manage the petition: configure all four legal requirements using fictional sample source documents for a demo (real collection requires the responsible authority’s exact documents). Until configured, signing is blocked. Then post an update, edit its title/action with a public explanation, and inspect History. Add Sam as collaborator in the local demo. After a signature, eligibility and public identity rules are locked.
7. Switch to Sam, set up Sam’s separate fictional signature vault, sign the new petition anonymously, add a structured discussion contribution, join Riverton students, and post in its community conversation. Endorse the petition as a community Sam owns.
8. For custom verification, switch to Jordan, open **Bring the courts back to life**, submit a non-sensitive eligibility statement. Switch to Sam → Manage → approve the request. Switch back to Jordan and sign anonymously.
9. Report a concern, confirm it, then find the private report in Profile and submit an appeal. Responses entered in Manage remain **unverified** and receive no official styling.
10. Profile → Simulate next write failure. Try saving or signing an unsigned petition. The temporary optimistic change rolls back with an actionable error. Retry succeeds. Reload the browser to verify persistence.

A concise presentation script is in [COMPETITION.md](COMPETITION.md).

## Validation

```sh
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:db
npm run export:web
npx expo install --check
```

Jest + React Native Testing Library cover ranking/diversity, deterministic AI, form validation, identity/eligibility combinations, permission-sensitive rendering, creation/publishing/signing, duplicate signatures under concurrent attempts, persistent state, custom approval, immutable rules, and actual TanStack optimistic rollback. `test:db` runs the real migration and repeatable seed in embedded PostgreSQL (PGlite), then exercises RLS, write denial, drafts, command permissions, eligibility, public anonymity, and reports. This does not replace staging tests of Clerk JWT issuance or Supabase hosting.

`npm run seed` regenerates `supabase/seed.sql` from the same typed fictional seed factory used locally. The SQL seed is repeatable; it does not delete data. The local reset control regenerates its data separately. Seed deadlines are June 30, 2027; move them forward in `src/data/seed.ts` before demonstrations after that date. New petition deadlines must be in the future.

## Architecture

```text
app/                       Expo Router routes, five tabs and deep links
src/components/            Accessible controls, topic art, cards, progress, entries
src/domain/model.ts        Typed data model and command / adapter contracts
src/domain/rules.ts        Pure ranking, AI rubric, schemas, privacy and permissions
src/data/local.ts          Serialized transactional demo adapter + persistence
src/data/supabase.ts       Clerk-token authenticated RPC adapter
src/data/database.types.ts RPC types and relational database table types
src/data/provider.tsx      TanStack Query, isolated sessions, optimistic rollback
supabase/migrations/       PostgreSQL tables, RLS, narrowly authorized RPCs
supabase/seed.sql          Repeatable fictional dataset
scripts/test-database.ts   Embedded PostgreSQL integration verification
```

There is one `Adapter` boundary for queries and typed commands. Screens never write directly to Supabase tables. The local adapter serializes writes and persists before committing its in-memory state, preventing duplicate signatures and ensuring failed writes do not appear successful. TanStack Query cancels stale reads, captures the prior snapshot, applies a temporary change, rolls back failures, and revalidates after mutations. Filters remain in mounted tabs; the wizard backs up writing on-device after a short pause. Save draft works from every step without publish-time validation and stores multiple private drafts in the account. Profile resumes, updates, and deletes them. Publishing atomically removes the corresponding saved draft.

The ranking recipe is 35% interests (25% explicit interests plus up to 10% proportional topic matches from prior signatures when history is enabled; otherwise 35% explicit interests), 30% same approximate city, 20% joined community, 10% freshness/activity, and 5% capped endorsements. A greedy diversity pass avoids three consecutive cards from one topic/community when alternatives exist. Trending caps signature velocity, saves, and discussion activity and discounts tiny samples. No political affiliation is inferred. The visible AI completeness rubric is deterministic, editable, and never claims to establish truth.

See [DECISIONS.md](DECISIONS.md) for privacy and engineering tradeoffs.

## Switch to Supabase + Clerk

1. Create Supabase and Clerk development projects. Enable the **Clerk third-party authentication integration** in Supabase. The RPCs use the signed JWT `sub`; they do not assume Clerk IDs are Supabase UUIDs. See [Supabase Clerk integration](https://supabase.com/docs/guides/auth/third-party/clerk).
2. Apply every SQL file in `supabase/migrations/` in filename order with the Supabase CLI or SQL editor, then optionally apply `supabase/seed.sql` to a **development** database. Seed accounts have no Clerk mapping and cannot be logged into remotely.
3. Copy `.env.example` to `.env`. Set `EXPO_PUBLIC_BACKEND=supabase`, your public project URL, public anon/publishable key, and Clerk publishable key. Never use a service-role key or Clerk secret key in Expo configuration.
4. Configure Clerk's hosted sign-in/sign-up and authorized web origins. Native sign-in uses the hosted account portal with `swipe4change://auth-callback`; register the scheme in Clerk and build a development client. Web uses Clerk's SignIn component. On first authenticated snapshot, a private subject mapping and a public `Community member` profile are provisioned. The mapping never leaves PostgreSQL.
5. If email-based eligibility is needed, configure a trusted boolean `email_verified` session claim sourced from Clerk's verified primary email. Initial provisioning reads this signed claim. Later verification changes must be synchronized by a trusted webhook/admin process; the client cannot self-award email or location approval. Missing claims deny email eligibility. Never derive location approval from the editable city field.
6. Grant real community ownership/moderator roles and display names through trusted provisioning. The local demo collaborator picker uses the three fictional profiles; production collaborator invitations and user discovery need a reviewed invite flow. For now, provision collaborators administratively in `petition_collaborators` rather than using the fictional picker.
7. Test on staging with two distinct Clerk users. Verify private drafts, duplicate signatures, anonymous projection, wrong-owner update rejection, and hidden reports. Confirm JWT issuer/audience/claim configuration for your actual Clerk instance before public release.

Regenerate matching relational row types from the migration with `npm run types:db`, then run `npm run format`.

The typed RPC boundary includes `lookaware_snapshot`, `lookaware_command`, `lookaware_requests`, `lookaware_community_posts`, plus owner-only `signature_vault`, `signature_receipt`, and `circulator_affidavits`. Every exposed table has RLS. Direct client writes are revoked; commands take identity from the validated JWT, enforce ownership/eligibility, and lock the petition row while signing. A database unique constraint enforces one `(petition_id, user_id)` signature. Private profiles, reports, and verification mappings never enter public signature payloads. SQL security-definer functions pin an empty search path and explicitly restrict execute grants.

**Trusted operations:** real official-response verification, email/location approval, report decisions, final appeal review, and discretionary badge awards must run server-side. No client route can grant these powers. First voice, Showing up, Community builder, Change starter, and Conversation starter are awarded transactionally from confirmed activity; profile editing cannot grant badges. The fictional verified response is clearly labeled in both seed data and the UI.

## Scope and limitations

- The fully working competition flow uses a local device adapter. Hosted RPCs are exercised in PostgreSQL, but live Clerk/Supabase credentials, external webhooks, native device signing, and EAS builds require your accounts/tooling.
- Demo accounts and approvals are deliberate simulations. Local storage is not an authorization boundary for hostile users; Supabase is the production boundary. Do not enter real personal or sensitive data in the local demo.
- The app stores approximate city/state, never exact GPS/address data for personalization. No contact details or authentication subjects are projected into public records. Creator-supplied free text must not contain private information; production needs moderation, rate limits, and abuse controls.
- Official verification and report/appeal review have no live staffed service. An organizer can record an **unverified** response, not verify an official. Real badge/admin operations need audited trusted infrastructure.
- Evidence uses labeled HTTPS links, not uploaded files. There is no map, background digest, push delivery, realtime subscription, advanced residency verification, or draft collaboration. Expo Notifications is configured for a later opt-in notification flow; no permissions are requested now. Optional map and these P2 features are outside this vertical slice.
- Snapshot reads favor a dependable small demo. Production needs pagination, indexed search, batched public aggregates, realtime invalidation, and load testing. Fictional activity counters are clearly identified and must not be used for live communities.
- Native share uses the platform sheet. Web copies the petition URL with a visible confirmation. Native sharing uses the `swipe4change://` deep link; set your deployed web origin instead if recipients should also open links in a browser. Local demo data stays on the originating device. Web hosting must serve `index.html` for deep-link fallback because the Expo export is a single-page app.
- Accessibility uses 44+ point controls, semantic labels, high-contrast tokens, natural text scaling, reduced-motion support for swipe animations, keyboard focus through native web controls, and responsive layouts. VoiceOver/TalkBack testing on real devices remains necessary before release.

## Discovery, writing, and profile updates (September 10)

Home is a single-card swipe deck: left passes, right opens review, and buttons offer the same actions to keyboard and assistive-technology users. Passing is reversible and never signs. Already-signed petitions are omitted from the deck. Explore and Saved retain browsable grids. Topic filters scroll horizontally on phones; desktop uses a 220-point navigation rail and supplementary community panels.

Profile supports display name, a 280-character bio, avatar selection, accent color, participation counts, earned badges with visible criteria, and an opt-out for signing-history personalization. Changing a display name does not rewrite historical signatures.

The simulated AI assigns a suggested department from the topic, issue text, and approximate city. Creators can edit the recipient or disable automatic assignment. It structures supplied observations into a request with a response deadline, offers reversible title/summary/body improvements, and provides relevant official research links. These are research starting points, not claims that a statute applies. Current references: [DOJ Title II guidance](https://www.ada.gov/topics/title-ii/) and [EPA Clean Water Act overview](https://www.epa.gov/laws-regulations/summary-clean-water-act). Confirm local jurisdiction and facts before relying on a legal basis.

## Private signature vault

Profile can save a printed legal name, registered residence address, jurisdiction, handwritten signature, and explicit residence self-attestation. **Use fictional information in the demo.** The vault is separate from public profile personalization and the feed. Saving it does not sign a petition or establish legal validity.

Encryption uses Expo Crypto AES-256-GCM with a fresh nonce and authentication tag. A randomly generated 256-bit recovery key is shown at setup; save it in your password manager. It is never persisted or sent to the backend. Additional authenticated data binds ciphertext to the owning profile and format version. Only the encrypted envelope is persisted; the Supabase table is in the private schema with RLS and no direct client access. A dedicated authenticated RPC returns only the current owner's ciphertext. The general snapshot, managers, and public signatures never include it. Locking clears form/key state on route blur, backgrounding, or after five minutes. JavaScript strings cannot be guaranteed zeroed from process memory; this is not a hardware-backed wallet. The owner can delete the vault. Lost keys cannot be recovered; delete and recreate the profile instead.

The cryptographic round trip is tested with standards-based WebCrypto, including wrong keys, altered ciphertext, unique nonces, and wrong-owner authenticated data. Native encryption uses the installed Expo implementation and still needs real-device QA. [Expo Crypto reference](https://docs.expo.dev/versions/latest/sdk/crypto/).

## Mandatory legal qualification workflow

Every petition receives a qualification record and a four-part checklist. A newly published petition cannot collect signatures until its organizer configures the jurisdiction, responsible authority, filing reference, complete official title/text, authority source, exact statutory count and rule, circulator declaration, and notarization requirement. The support goal is separate. Seeded petitions carry explicitly fictional, **unapproved** example requirements; sample counts never count toward legal qualification.

Signing requires a saved private vault, the configured account/eligibility check, and fresh explicit consent. The app encrypts a separate signatory record authenticated against the exact disclosed text and legal requirements. The server compares that disclosure under the petition row lock, rejecting a stale form. Receipt and public support entry commit together; failures roll back. Receipts are owner-only, append-only and remain unchanged when a profile vault is updated/deleted. Legacy support without a receipt is not accepted for legal qualification. Legal requirements lock after the first receipt; a different measure needs a new petition.

Manage → Circulator affidavits lets an organizer/collaborator select specific signature records, affirm the exact required declaration, unlock their own signature, and supply private signed-sheet and notarial-document references. Those private details are encrypted with a separate authenticated context. Submission is **pending**, not proof of witnessing or notarization. Merely seeing a digital signature or using the app does not satisfy a legal witnessing rule. Affidavits cannot be rewritten after submission and are visible only to their submitting collector; public views expose aggregate counts.

The four checklist items distinguish encrypted signatory records, accepted affidavits, reviewed official text, and the exact threshold. Only accepted signatures count toward that threshold. All acceptance functions are database-owner-only, revoke app-role access, require explicit external review references, and append an audit entry. The app never grants itself or an organizer authority to certify legal validity.

### Trusted review procedure

Use the Supabase SQL editor as the database owner after a responsible authority has actually reviewed the underlying records. Never put administrator credentials in Expo. The following are **function signatures, not instructions to approve an unreviewed petition**:

```sql
-- Official text, jurisdiction, threshold rule/count and affidavit wording checked against the authority's document:
select private.review_qualification(petition_uuid, approved_boolean, public_authority_reference);
-- Collector's underlying witnessed sheets, signature and (when required) notarization independently checked:
select private.review_affidavit(affidavit_uuid, approved_boolean, notarization_verified_boolean, private_review_reference);
-- Registration/address and signature independently matched, with an accepted affidavit covering this exact receipt:
select private.review_signature(receipt_uuid, affidavit_uuid, approved_boolean,
  registration_match_boolean, signature_valid_boolean, private_review_reference);
```

These functions **record external verification; they do not perform it**. No voter-roll integration, notarial service, jurisdiction-approved e-signature collection, authority filing or staffed review service is included. Reviewers need the applicable original documents through the authority’s approved secure process; encrypted records cannot be inspected without the owner's key. Requirements review notes are public; affidavit/individual review notes are owner-only. Do not put private evidence in a public reference. Revoke dependent signature acceptance before rejecting an accepted affidavit or requirements document. The immutable consent remains for audit.

No saved drawing, AI suggestion, checkbox, threshold calculation or notarization assertion automatically creates legal validity. Requirements vary: consult the responsible election office and [California’s initiative qualification guidance](https://www.sos.ca.gov/elections/ballot-measures/how-qualify-initiative) or [Washington’s initiative instructions](https://www.sos.wa.gov/elections/initiatives-instructions) for their specific processes. Do not apply a state initiative threshold to a local petition without the local authority’s rule.

Additional smoke checks:

- At 390px and desktop width, filter a topic, pass a card, undo the pass, and review it without signing.
- Save an incomplete petition, switch accounts to confirm privacy, return to resume it, then publish the completed draft.
- Edit a bio, avatar and color; reload; toggle signing-history ranking off.
- Create a fictional signature vault, save its key privately, draw and encrypt a sample signature, reload and unlock; verify a wrong key fails and deletion removes it.

- Open Legal requirements on a petition; distinguish sample support, recorded encrypted signatures, accepted signatures, and the exact statutory threshold.
- Sign with a fictional vault and explicit full-text consent. Read your immutable receipt, then confirm that changing the profile does not rewrite it.
- In Manage, submit a fictional circulator affidavit covering a recorded signature. It must remain pending and the accepted qualification count must stay zero.
- Use `npm run test:db` to exercise the complete **fictional** trusted review sequence, including rejection without notarization, a registration match, correct official text, or a covering affidavit.

## Visual theme

The supplied LookAware HTML reference is adapted to Swipe4Change’s existing workflows: warm ivory (`#F7F7F2`), sage (`#899878`), pale olive (`#E4E6C3`), charcoal text, Newsreader editorial headings, and Work Sans body text. Shared colors, typography, spacing, radii, and shadows live in `src/components/theme.ts`. Sage buttons use charcoal labels; small accent text uses darker olive for readable contrast.

The desktop Home page uses an editorial hero, snapshot-derived metrics, a three-column petition grid, community links, and a guided creation call to action. Desktop navigation is in the persistent header; phones retain all five bottom tabs and default to swipe browsing. Home provides Card view and Swipe view controls. Search, topic filters, saves, petition review, and eligibility/confirmation flows remain connected to the existing data layer.

Newsreader and Work Sans are bundled through Expo Font. The six illustrative photos in `assets/theme/` come from the supplied HTML reference and are bundled for offline use. They are theme artwork, not evidence or photographs of the fictional petition locations, and are labeled accordingly. The reference’s platform statistics, legislative victories, certification promises, and donation/funding claims are not product claims. All demo data continues to be labeled fictional.

Theme smoke check: open Home and Explore at 390px and 1440px; check navigation, search, topic filters, Card/Swipe view, saving, and petition detail; open Create, Communities, Profile, and signing confirmation to check shared styles. Desktop layout should have no sidebar or horizontal clipping; mobile primary controls should remain at least 44 points.
