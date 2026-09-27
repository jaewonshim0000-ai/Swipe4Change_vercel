# Swipe4Change ↗

A mobile-first civic petition app for iOS, Android, and web. Notice something, understand the request, choose how to participate, and follow the next step.

**The default app is a complete, persistent local demo. No credentials are required.** Every account, community, organization, official response, source, and seed signature is fictional. The local adapter simulates eligibility; it does not verify real people. This is a competition prototype, not a deployed civic service.

The public app name is **Swipe4Change**. New native links use `swipe4change://`; the original `lookaware://` scheme remains an alias for existing links. Bundle/package IDs (`org.lookaware.app`), local storage/draft keys, and the existing migration/RPC names remain stable to preserve installed-app identity, saved demo data, and backend compatibility. Register `swipe4change://auth-callback` in Clerk before using native hosted sign-in with the renamed build. Rebuild native apps to pick up the display name and URL scheme.

## The Eastbridge journey

Home now opens with a local welcome and the Eastbridge lighting spotlight, followed by the personalized swipe deck, compact collections, community activity, and a creation invitation. Explore searches petition and community text with a filter sheet for location, eligibility, recipient level, community, deadline, and recent updates. Match explanations use only explicit interests, approximate location, membership, and visible activity.

Petition details use **Story / Progress / Activity**. Read the request and sources in Story, milestones and the recorded hand-off/response in Progress, and organizer updates, discussion, endorsements, and edits in Activity. On phones, a signing bar appears after the opening action leaves view.

Signing takes three steps: read the exact text (with the eligibility check), choose how your name appears with a preview of the exact public name, then draw your signature and tick an unchecked consent box. The drawing is stored with the exact text you read and only you can open it; organizers and the public see the display name you chose. If the organizer edits the petition while you are reading, the signature is refused and you are asked to reread it. The confirmation appears only after the data adapter accepts the write, and then invites you to start a ripple.

Create uses **Define the change / Build the case / Configure participation / Review and publish**. The prototype writing assistant remains visible on the review step; both card and detail previews are available. Research and recipient-directory guidance is expandable. The assistant suggests a recipient category but never silently assigns an office; creators must identify the actual recipient themselves. Existing saved drafts keep their content and step number; because fields were regrouped, review all four steps before publishing an older draft. Profile puts participation and joined communities before drafts, personalization, and private settings.

Fresh local data includes Maya's saved shade-tree petition, plus a fictional delivery linked to the lighting response. All twelve sample petitions have distinct local problems and a fictional responsible office matched to the request. Existing on-device work is never reset automatically. To see fresh sample content, use the existing confirmed **Profile → Reset all local demo data** action after preserving any demo work you want to keep. `npm run seed` regenerates the equivalent SQL fixture; run it only in a development database.

The no-network demonstration remains the default local adapter. Hosted failures show an error and retry; the app does not silently turn a rejected Supabase signature into a successful local signature. For an offline presentation, start with the default local backend. No dependencies or backend migrations were needed for this refinement.

Validation for this version: typecheck, lint and Prettier pass; all 91 Jest tests in 16 suites pass; PostgreSQL integration passes with 23 RLS-protected tables and repeatable seed execution; Expo exports the web bundle. Browser checks at 375px cover the three-step signing flow with a drawn signature, sharing a ripple link, signing through it as another account, the referrer's notification, and the ripple on the petition page, profile and organizer dashboard. Physical-device builds and live Clerk/Supabase authentication were not exercised in this local environment.

### Refinement smoke checklist

- At 320px, 390px, tablet, and desktop widths, check the header, navigation, card text, filter sheet, and all four creation steps. Increase system text size; the swipe card now grows with its content.
- Sign in as Maya, complete onboarding, and open **Understand this petition**. Check the recipient, 684 sample signatures, and next milestone of 750.
- Open **Progress** and inspect the 500-signature sample delivery and the linked fictional response. **Activity** exposes discussion and edits without seven tabs.
- Open **Review and sign**. Confirm stays disabled until you have drawn a signature and ticked consent, which starts unchecked. Each public-name preview must match the recorded public name.
- Choose Profile's simulated write failure before signing; no success confirmation should appear. Retry, then check the confirmation, **Your signature**, progress and duplicate prevention.
- After signing, tap **Share my link**, switch to Sam, open the copied link and sign. Switch back to Maya: the bell shows **Your ripple grew** without naming Sam, and the petition page, Profile and Manage all show the ripple.
- In Explore, combine topic, city, requirement, and deadline filters; cancel the sheet to discard unapplied edits, and clear filters to recover results.
- Create a request, use and undo assistant suggestions, preview both layouts, and publish only after the final confirmation. A published petition can be signed straight away.
- Visit a joined community, post a permitted structured contribution, and view participation in Profile. Reload a petition/community deep link and check guest access and manager-only controls.
- Use an OS reduced-motion preference to check that deck and confirmed-progress effects stop. Check keyboard focus and modal controls on web.

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

## Delivery: the document that gets sent

A petition that never reaches anyone is a dead end, so the hand-off is recorded rather than assumed.
An organizer previews the **delivery packet** — the petition text, the requested action, the
recipient and their level of government, the organizer's sources, the signature count, the
eligibility rule, and the public signature list — then records how and when it was sent. Web prints
it or saves it as a PDF; a device shares it.

The packet freezes the count and the names at the moment of delivery, because a document sent to a
public office has to say what was actually sent, not what the petition grew into afterwards. It
contains only what the petition already shows publicly: names appear exactly as each signer chose,
anonymous signers are counted but never named, and no contact details or verification evidence
appear anywhere. An official response can then be attached to the delivery it answers.

## Who can actually decide this?

**Explore → recipient directory** (also reachable from the create flow and any petition page) lists
fictional local offices with their level of government, what each one can decide, what it cannot and
who can instead, and its published response time. The create flow ranks offices by topic and wording
so a request starts out addressed to somebody who can act on it. The recipient field stays free text
— the directory helps, it does not constrain.

Every office is invented for this demo. A real deployment would load its own jurisdiction's
directory, and response times would come from that jurisdiction's published service standards.

## Can everyone read it?

Alongside the completeness score, the create flow measures whether the petition is actually readable:
a Flesch–Kincaid grade level against a target of grade 9, plus flags for passive clauses that hide
who should act, vague verbs like "improve" that no office can schedule, and asks with no number or
date in them. It runs on your own words, rewrites nothing, and never blocks publishing.

## Ripple: see the change you started

Once you have signed a petition, your share link carries an opaque ripple code. Everyone who signs
through it joins your ripple, and so does everyone who signs through _their_ links. The petition page,
your profile and the signing confirmation show the ripple as rings around you: how many signed
through you, and how many more through them. When someone signs through your link you get a
**Your ripple grew** notification. Organizers see how many real signatures arrived through supporter
links, and everyone sees one public line: “N signed because a supporter shared it.”

It is built to reward spreading without exposing anyone:

- **Counts only.** Nobody is ever told who signed through their link. The code in a link is random on
  the hosted backend (a stable hash in the local demo) and never a profile id.
- **Only signers earn credit.** A link counts once its owner has signed that petition. Your own link,
  a stale link or a made-up code is ignored — it never blocks the signature itself.
- **Withdrawal is respected.** Withdrawing a signature removes it from whichever ripple it was in.
- **Arrival is remembered.** Open a shared link, wander off, and sign later: the credit still goes to
  whoever shared it. The code is kept on the device until a signature uses it.

## Actions beyond signing

**Saving is following.** A saved petition sends its updates to your inbox, and so does one you signed
or offered to help with; there is no separate bookmark that stays silent. **Volunteering**
offers specific help — outreach, design and media, research or canvassing — under your profile name,
which the petition's organizers see along with your optional note in Manage. No contact details are
collected or shown, and the app has no volunteer messaging channel: coordination happens through
organizer updates and community posts so it stays visible to everyone involved. A volunteer can
revise their roles or step back at any time. Payment, donation and fundraising remain out of scope.

## Community collaboration spaces

Each community has three zones with different authority:

- **Public discussion** — members post; anyone can read. Posts carry an optional topic channel.
- **Announcements** — only the owner and moderators post, in the community's voice; anyone can read.
- **Organizer space** — a private working room only the owner and moderators can read or post in.

A fourth zone, **Campaign updates**, is read-only: it collects the organizer updates written on this
community's petitions. They are posted from the petition itself, where everyone who saved or signed it
is notified, rather than duplicated here.

Within those zones the same post record renders discussion, announcements, an **Events** list (soonest
first), the organizer room, the campaign-update feed, and a moderator-only report queue. A report shows
moderators the post, its author and the reason, never who reported it.

## End-to-end smoke walkthrough

1. Enter as Maya, choose interests, and set `Riverton, CA`. Read **How your feed works**. Use topic chips, Trending, Explore search, Near me, and Saved.
2. Open **A brighter walk home starts here**. Inspect the requested action, source disclosure, update, edit history, community endorsement, milestones, and explicitly fictional verified response.
3. Tap **Review and sign**, read the complete text, choose **Anonymous**, draw a signature and explicitly consent. Progress and public supporters update; the public name is **Anonymous supporter**. **Your signature** shows the drawing and the exact text you signed, to you only. A second signature is blocked. The profile receives a First voice badge. Tap **Share my link** to copy your ripple link.
4. Create → Safer walk template. Write a specific problem and action. Apply the **simulated AI** suggestion, undo it, or edit it. Continue and enter the recipient, summary, city, goal, future deadline, and optional labeled HTTPS evidence.
5. Choose `email` for private eligibility and allow `anonymous` publicly. Review the card and full text. Confirm publishing. The new petition appears in Home and Profile → Created. You can save incomplete drafts from any step and resume them from Profile. Previously created petition drafts remain publishable from Manage.
6. Manage the petition: post an update, edit its title/action with a public explanation, and inspect History. Add Sam as collaborator in the local demo. After a signature, eligibility and public identity rules are locked.
7. Switch to Sam, open the ripple link Maya copied in step 3 and sign the flagship through it — Maya's bell now says **Your ripple grew**, without naming Sam. Then sign the new petition anonymously, add a structured discussion contribution, join Riverton students, and post in its community conversation. Endorse the petition as a community Sam owns.
8. For custom verification, switch to Jordan, open **Bring the courts back to life**, submit a non-sensitive eligibility statement. Switch to Sam → Manage → approve the request. Switch back to Jordan and sign anonymously.
9. Report a concern, confirm it, then find the private report in Profile and submit an appeal. Responses entered in Manage remain **unverified** and receive no official styling.
10. Follow the loop back. As Jordan, **Save** the flagship petition without signing it, switch to Maya, post an organizer update, then switch back to Jordan and open the bell: saving is how you follow a petition. Organizers see the other direction — Maya's notifications list Sam's signature (as **Anonymous supporter**, never by account name), the community endorsement, the discussion post, and any waiting eligibility request.
11. Revise a published petition. Maya → Manage → **Edit transparently** now edits every content field — summary, problem, recipient, location, goal, deadline and sources — not just title and action. Change the recipient and the goal, read the pending-changes line, confirm, and check the before/after wording in **History**. Signing rules stay locked because signatures exist; topic and community are fixed for every published petition.
12. Withdraw and retract. On a petition Sam signed, open **Change your mind** and withdraw: the count drops, the public supporter row goes, the drawn signature is deleted, and it leaves any ripple it was part of. Remove one of your own discussion posts and watch it become a visible “removed by its author” note rather than a gap.
13. Create and moderate a community. Communities → **Create a community**; you become owner and first member, with a headcount carrying no fictional padding. Appoint a member as moderator and retract a post as owner. Then Manage → close a petition and **Archive permanently**: it leaves every feed, search result and profile, including your own.
14. Profile → Simulate next write failure. Try saving or signing an unsigned petition. The temporary optimistic change rolls back with an actionable error. Retry succeeds. Reload the browser to verify persistence.

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

Jest + React Native Testing Library cover ranking/diversity, deterministic AI, form validation, identity/eligibility combinations, permission-sensitive rendering, creation/publishing/signing, duplicate signatures under concurrent attempts, persistent state, custom approval, immutable rules, actual TanStack optimistic rollback, notification fan-out and its anonymity guarantee, milestone crossing, full-field revision with locked audience fields, signature withdrawal, rolling velocity, community creation and moderation, post tombstones, archival, report withdrawal, drawn-signature validation, and ripple attribution (direct and further counts, loops, self-links, unknown codes, withdrawal, anonymity). `test:db` runs the real migration and repeatable seed in embedded PostgreSQL (PGlite), then exercises RLS, write denial, drafts, command permissions, eligibility, public anonymity, reports, and the recursive ripple query. This does not replace staging tests of Clerk JWT issuance or Supabase hosting.

`npm run seed` regenerates `supabase/seed.sql` from the same typed fictional seed factory used locally. The SQL seed is repeatable; it does not delete data. The local reset control regenerates its data separately. Seed deadlines are spread 18-300 days ahead of the moment the seed runs, so they never expire and Explore’s **Ending soon** section has something to sort. New petition deadlines must be in the future.

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

Notifications fan out from a single helper in each adapter over two audiences: _followers_ (everyone who signed, saved or volunteered for the petition) and _managers_ (owner and collaborators), each excluding whoever performed the action. Organizer-facing notices carry only the public identity a signer chose, so an anonymous signature stays anonymous in the organizer's inbox. Signature velocity used for Trending is recomputed over a trailing seven days rather than accumulated, and the signing timestamp never reaches the public signature projection.

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

The typed RPC boundary includes `lookaware_snapshot`, `lookaware_command`, `lookaware_requests`, `lookaware_community_posts`, `lookaware_community_reports`, `lookaware_volunteers`, and the owner-only `signature_receipt`. Every exposed table has RLS. Direct client writes are revoked; commands take identity from the validated JWT, enforce ownership/eligibility, and lock the petition row while signing. A database unique constraint enforces one `(petition_id, user_id)` signature. Private profiles, reports, and verification mappings never enter public signature payloads. SQL security-definer functions pin an empty search path and explicitly restrict execute grants.

**Trusted operations:** real official-response verification, email/location approval, report decisions, final appeal review, and discretionary badge awards must run server-side. No client route can grant these powers. First voice, Showing up, Community builder, Change starter, and Conversation starter are awarded transactionally from confirmed activity; profile editing cannot grant badges. The fictional verified response is clearly labeled in both seed data and the UI.

## Scope and limitations

- The fully working competition flow uses a local device adapter. Hosted RPCs are exercised in PostgreSQL, but live Clerk/Supabase credentials, external webhooks, native device signing, and EAS builds require your accounts/tooling.
- Demo accounts and approvals are deliberate simulations. Local storage is not an authorization boundary for hostile users; Supabase is the production boundary. Do not enter real personal or sensitive data in the local demo.
- The app stores approximate city/state, never exact GPS/address data for personalization. No contact details or authentication subjects are projected into public records. Creator-supplied free text must not contain private information; production needs moderation, rate limits, and abuse controls.
- Official verification and report/appeal review have no live staffed service. An organizer can record an **unverified** response, not verify an official. A reporter can withdraw their own report; the `reviewed` state is reserved for trusted server-side review that does not exist here. Real badge/admin operations need audited trusted infrastructure.
- Community moderation covers post retraction only. Owners appoint moderators from actual members, and the demo picks them from the three sample accounts. Member removal, banning, and production moderator invitations are deliberately absent: they need an appeals process this prototype cannot staff.
- Notifications are in-app only. Everyone who signed, saved or volunteered for a petition hears about its updates, material edits, signature milestones, recorded responses and closure; organizers hear about signatures, endorsements, discussion and eligibility requests. There is no push delivery, email, or digest.
- Evidence uses labeled HTTPS links, not uploaded files. There is no map, background digest, push delivery, realtime subscription, advanced residency verification, or draft collaboration. Expo Notifications is configured for a later opt-in notification flow; no permissions are requested now. Optional map and these P2 features are outside this vertical slice.
- Snapshot reads favor a dependable small demo. Production needs pagination, indexed search, batched public aggregates, realtime invalidation, and load testing. Fictional activity counters are clearly identified and must not be used for live communities.
- Native share uses the platform sheet. Web copies the petition URL with a visible confirmation. Native sharing uses the `swipe4change://` deep link; set your deployed web origin instead if recipients should also open links in a browser. Local demo data stays on the originating device. Web hosting must serve `index.html` for deep-link fallback because the Expo export is a single-page app.
- Accessibility uses 44+ point controls, semantic labels, high-contrast tokens, natural text scaling, reduced-motion support for swipe animations, keyboard focus through native web controls, and responsive layouts. VoiceOver/TalkBack testing on real devices remains necessary before release.

## Discovery, writing, and profile updates (September 10)

Home is a single-card swipe deck reading three directions: right supports (opening the signing sheet, never signing), left passes, up opens the full page. Four circular actions plus a Volunteer / Share row give every gesture a labelled equivalent for keyboard and assistive-technology users, so the deck is fully usable without dragging. Passing is reversible and never signs. Already-signed petitions are omitted from the deck. Saved retains a browsable grid. Explore lists compact rows on phones - a 98-point image column beside title, location, days left and progress - and the same grid at 760 points and wider; its sections are Trending, Near you, Recently updated, Ending soon and Saved. Topic filters scroll horizontally on phones; desktop uses a 220-point navigation rail and supplementary community panels.

Profile supports display name, a 280-character bio, an initials avatar, participation counts, your ripple, earned badges with visible criteria, and an opt-out for signing-history personalization. Changing a display name does not rewrite historical signatures.

The simulated AI suggests a recipient category from the topic, issue text, and approximate city. It never fills the actual recipient field or fabricates an office. Creators choose an office or enter one after confirming its jurisdiction. The assistant structures supplied observations into a request with a response deadline, offers reversible title/summary/body improvements, and provides relevant official research links. These are research starting points, not claims that a statute applies. Current references: [DOJ Title II guidance](https://www.ada.gov/topics/title-ii/) and [EPA Clean Water Act overview](https://www.epa.gov/laws-regulations/summary-clean-water-act). Confirm local jurisdiction and facts before relying on a legal basis.

Additional smoke checks:

- At 390px and desktop width, filter a topic, pass a card, undo the pass, and review it without signing.
- Save an incomplete petition, switch accounts to confirm privacy, return to resume it, then publish the completed draft.
- Edit a bio; reload; toggle signing-history ranking off.
- Sign, then edit the petition as its organizer: **Your signature** still shows the text you originally read.
- Open a ripple link as Sam, go Home, then return to the petition without the link and sign: the credit still reaches the sharer. Withdraw and watch the ripple shrink.

## Visual theme

The supplied LookAware HTML reference is adapted to Swipe4Change’s existing workflows: warm ivory (`#F7F7F2`), sage (`#899878`), pale olive (`#E4E6C3`), charcoal text, Newsreader editorial headings, and Work Sans body text. Shared colors, typography, spacing, radii, and shadows live in `src/components/theme.ts`. Sage buttons use charcoal labels; small accent text uses darker olive for readable contrast.

The desktop Home page uses an editorial hero, snapshot-derived metrics, a three-column petition grid, community links, and a guided creation call to action. Desktop navigation is in the persistent header; phones retain all five bottom tabs and default to swipe browsing. Home provides Card view and Swipe view controls. Search, topic filters, saves, petition review, and eligibility/confirmation flows remain connected to the existing data layer.

Newsreader and Work Sans are bundled through Expo Font. The six illustrative photos in `assets/theme/` come from the supplied HTML reference and are bundled for offline use. They are theme artwork, not evidence or photographs of the fictional petition locations, and are labeled accordingly. The reference’s platform statistics, legislative victories, certification promises, and donation/funding claims are not product claims. All demo data continues to be labeled fictional.

Theme smoke check: open Home and Explore at 390px and 1440px; check navigation, search, topic filters, Card/Swipe view, saving, and petition detail; open Create, Communities, Profile, and signing confirmation to check shared styles. Desktop layout should have no sidebar or horizontal clipping; mobile primary controls should remain at least 44 points.
