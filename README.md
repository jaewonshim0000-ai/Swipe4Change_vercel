# Swipe4Change ↗

A mobile-first civic petition app for iOS, Android, and web. Notice something, understand the request, choose how to participate, and follow the next step.

**Full feature list:** [FEATURES.md](FEATURES.md).

## Design and motion

The app implements the **Swipe4Change v3** design in [`design/swipe4change-v3/index.html`](design/swipe4change-v3/index.html) (open it in a browser to compare; it reads its photos from `assets/photos/`): Plus Jakarta Sans throughout, the floating dark tab bar on phones and tablets and a dark sidebar (an icon rail in narrow windows) on desktop web, a full-photo swipe card with three tap-through pages (overview, the problem, the ask) and round undo / pass / save / sign / share buttons, Explore's photo-tile grid with emoji topic chips, Communities as a "Recommended for you" list, a Profile hero with overview tiles and badge progress rows, the gradient "Draft it with AI" card in Create, the petition page's "The ask" box and sticky save / share / sign foot, and the full-screen "It's signed!" celebration. The earlier v2 handoff stays in [`design/petition-app-mobile-design/`](design/petition-app-mobile-design/project/Swipe4Change%20v2.dc.html) for reference; where v3 would have removed or changed an app feature, the feature was kept and styled in the v3 language (see DECISIONS.md, "Swipe4Change v3 design").

Motion is ported one-to-one: the design's CSS keyframes (`s4In`, `s4Slide`, `s4Sheet`, `s4Ken`, `s4Ring`, `s4Pop`, `s4Toast`, …) live in `src/components/motion.ts` as Reanimated 4 CSS animations with the same durations, delays and `cubic-bezier(.2,.8,.2,1)` easing, and run on iOS, Android and web. The swipe deck, parallax and score ring use Reanimated shared values. Everything respects the system reduced-motion setting. A quick flick commits a short swipe and a cancelled drag springs back; on phones `haptic()` ticks at the commit line, taps on save and buzzes on a confirmed signature (it does nothing on the web).

Screens style inline, so `tests/design-tokens.test.ts` keeps every inline font size on the theme `typeScale`, every radius on `radii` (999 for pills and circles) and every colour a named token in `src/components/theme.ts`. Add a step there before using a new size. Features the design does not show (manager tools, delivery packets, volunteering roles, reports and appeals, drafts, moderation) keep working and use the same components, sheets and tokens.

**The app defaults to hosted Supabase with Clerk authentication. No Docker is required.** An offline fictional demo is available by explicitly setting `EXPO_PUBLIC_BACKEND=demo`. Every seeded account, community, organization, official response, source, and signature is fictional. The local adapter simulates eligibility; it does not verify real people. This is a competition prototype, not a deployed civic service.

The public app name is **Swipe4Change**. New native links use `swipe4change://`; the original `lookaware://` scheme remains an alias for existing links. Bundle/package IDs (`org.lookaware.app`), local storage/draft keys, and the existing migration/RPC names remain stable to preserve installed-app identity, saved demo data, and backend compatibility. Register `swipe4change://auth-callback` in Clerk before using native hosted sign-in with the renamed build. Rebuild native apps to pick up the display name and URL scheme.

## Adaptive web layout

Run `npm run web` to use the same app in a browser. Below 900px, web keeps the mobile navigation and single-column discovery. At 900px and above, navigation stays fixed at the bottom with every destination labeled; Home, Explore, and Communities use a centered canvas up to 1200px wide with two-column results. Home is the swipe deck on every width. Resizing preserves search, filters, and draft state.

Forms, profiles, onboarding, and detail pages stay within a 760px reading width. Desktop confirmation/filter sheets are centered dialogs; narrow screens retain bottom sheets. Native iOS/Android retain their existing mobile layout. Breakpoints and width limits live in `src/components/responsive.tsx`.

Responsive smoke checks: resize between 390px, 768px, 900px, and 1440px; navigate all five tabs, search/filter Explore, open a petition and its signing sheet, and enter a Create draft before resizing. Check that navigation and form actions remain visible and no page scrolls horizontally.

## The Eastbridge journey

Home is the personalized swipe deck under a local welcome; **Change** opens the city picker. Every other way of finding petitions lives in Explore: while browsing it shows the live ticker, the Eastbridge lighting spotlight, compact collections and all petitions, with community activity and a creation invitation at the foot; searching or filtering shows only results. Explore searches petition and community text with a filter sheet for location, eligibility, recipient level, community, deadline, and recent updates. Match explanations use only explicit interests, approximate location, membership, and visible activity.

Petition details use **Story / Progress / Activity**. Read the request and sources in Story, milestones and the recorded hand-off/response in Progress, and organizer updates, discussion, endorsements, and edits in Activity. On phones, a signing bar appears after the opening action leaves view.

Signing takes three steps: read the exact text (with the eligibility check), choose how your name appears with a preview of the exact public name, then draw your signature and tick an unchecked consent box. The drawing is stored with the exact text you read and only you can open it; organizers and the public see the display name you chose. If the organizer edits the petition while you are reading, the signature is refused and you are asked to reread it. The confirmation appears only after the data adapter accepts the write, and then invites you to start a ripple.

On phones, Create follows the v3 design: a start screen (Draft it with AI, Write it myself, Continue your draft, templates), then one question per screen (12 questions covering every field, each with its hint and, for the written ones, an example), then a review with both previews, the writing check and an Edit link on every answer. On desktop, Create uses **Define the change / Build the case / Configure participation / Review and publish**. The prototype writing assistant remains visible on the review step; both card and detail previews are available. Research and recipient-directory guidance is expandable. The assistant suggests a recipient category but never silently assigns an office; creators must identify the actual recipient themselves. Existing saved drafts keep their content and step number; because fields were regrouped, review all four steps before publishing an older draft. Profile puts participation and joined communities before drafts, personalization, and private settings.

Fresh local data includes Maya's saved shade-tree petition, plus a fictional delivery linked to the lighting response. All twelve sample petitions have distinct local problems and a fictional responsible office matched to the request. Existing on-device work is never reset automatically. To see fresh sample content, use the existing confirmed **Profile → Reset all local demo data** action after preserving any demo work you want to keep. `npm run seed` regenerates the equivalent SQL fixture; run it only in a development database.

The no-network demonstration uses the optional local demo adapter. Hosted failures show an error and retry; the app does not silently turn a rejected Supabase signature into a successful local signature. For an offline presentation, set `EXPO_PUBLIC_BACKEND=demo`. No dependencies or backend migrations were needed for this refinement.

Validation for this version: typecheck, lint and Prettier pass; all 109 Jest tests in 19 suites pass; PostgreSQL integration passes with 23 RLS-protected tables and repeatable seed execution; Expo exports the web bundle. Browser checks at 375px cover the three-step signing flow with a drawn signature, sharing a ripple link, signing through it as another account, the referrer's notification, and the ripple on the petition page, profile and organizer dashboard. Physical-device builds and live Clerk/Supabase authentication were not exercised in this local environment.

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
# Set up Clerk and Supabase as described in SETUP.md (or set EXPO_PUBLIC_BACKEND=demo in .env).
npm run web
# Or run Metro for iOS / Android:
npm start
```

**Turn on the AI model for the offline demo (optional).** Report review and the hidden For You tags use Claude. Copy `.env.example` to `.env`, set `ANTHROPIC_API_KEY` (from console.anthropic.com), and restart `npm run web`. The key is read only by the dev server's `/api/ai` route (`app/api/ai+api.ts`) and never bundled into the app. Without a key the app still works: reports use keyword rules and tags come from word matching. On first launch with a key, the seed petitions are tagged in the background (one request each).

**Real officials and the AI recipient finder.** For any real US city, Create lists the city's two U.S. senators and House member (US Census geocoder + the public-domain `congress-legislators` dataset, no key) and, with `OPENSTATES_API_KEY` in `.env` (free at openstates.org), its state senator and representative. **Find the right recipient ✦** asks Claude (Opus 5.5 with up to five web searches) who can actually make the requested change in that place; it must cite pages its search returned or name one of the listed officials, and any source it did not actually find is dropped. It needs `ANTHROPIC_API_KEY`, costs a few cents per lookup, and only suggests: the creator taps **Use this**. Both run in the dev server's `/api/lookup` route (`app/api/lookup+api.ts`), so keys never reach the app. Districts are looked up for the city centre, so a large city's House member may not be everyone's. The fictional sample cities keep using the fictional recipient directory.

**Sending the packet.** Manage → Send it to the recipient: **Copy the packet**, then open a member of Congress's contact form or website, or open your email app addressed to the office's public email (prefilled for state legislators who publish one) with the request in the body and the full packet on the clipboard. The app can't see whether you pressed send, so it fills in the delivery record for you to confirm. Packets for real petitions no longer carry the "FICTIONAL" header; sample ones still do.

**AI petition writer.** Create → **Write it for me ✦**: the creator describes the problem in their own words (any language; phone dictation works) and Claude drafts the title, summary, problem, requested change and topic, in the language they used. It must not invent facts, numbers, dates, names, sources or officials, and it names no recipient; missing details come back as up to three questions. **Undo AI draft** restores the previous fields, and the creator still reviews every step. It runs through the same `/api/lookup` route (demo) or `civic-lookup` Edge Function (hosted) as the recipient finder; hosted AI requests are limited to signed-in users, 20 an hour each.

**Spam filter.** Every petition is checked as it is published and whenever its wording changes, for spam, threats, insults, hateful language and **nonsense** (gibberish, keyboard mashing, test posts). Flagged petitions are saved but held out of public view; the organizer sees why on the petition and in Manage, and editing the wording rechecks it. With no model available the keyword rules in `supabase/functions/_shared/civic-rules.ts` decide. In the demo the check runs instantly on the device; hosted, a new petition stays hidden with `screening = pending` until the `ai-review` Edge Function checks it (the app waits for that, usually seconds) — so **deploy `ai-review` before using hosted mode**, or new petitions stay pending. **Publishing needs a verified email** (Clerk's verified-email claim; in the demo, Jordan is the unverified account), while drafts do not. Photos are not screened automatically.

**Photos.** Create → Build the case → **Choose photo** (or **Take photo** on a phone) attaches one photo of the problem with a required screen-reader description; Manage → Photo changes or removes it. On the device the photo is resized to 1200 px wide, re-saved as JPEG and stripped of every metadata segment (EXIF/XMP, including GPS) by `stripJpegMetadata` in `src/domain/jpeg.ts` before it is uploaded. The demo stores it inline with the other on-device data; hosted mode uploads it to the public `petition-photos` Storage bucket (1 MB, JPEG only, random file names; only the uploader can replace or delete a file). It is attached by a separate organizer-only `photo` command after publishing, and every change is in the public edit history. The petition page labels it "Organizer’s photo" rather than "Illustrative image". Saved drafts keep their text only; add the photo when you publish or later from Manage. Rebuild native apps after pulling: `expo-image-picker` and `expo-image-manipulator` were added.

Choose Maya on the welcome screen, select at least three interests (or skip), choose a city (Riverton is listed as a fictional sample city), and continue. Data persists in AsyncStorage (browser local storage on web). Use Profile → Reset all local demo data to restore the community. No actual authentication secrets are stored in the demo.

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
revise their roles or step back at any time. An organizer can add an external HTTPS donation page from Manage; the petition then shows **Donate**, which warns that you are leaving the app before opening it. Swipe4Change never processes or holds money, and every change to the link is public edit history.

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
2. Open **A brighter walk home starts here**. Inspect the requested action, source disclosure, update, edit history, community backing, milestones, and explicitly fictional verified response.
3. Tap **Review and sign**, read the complete text, choose **Anonymous**, draw a signature and explicitly consent. Progress and public supporters update; the public name is **Anonymous supporter**. **Your signature** shows the drawing and the exact text you signed, to you only. A second signature is blocked. The profile receives a First voice badge. Tap **Share my link** to copy your ripple link.
4. Create → Safer walk template. **Already started?** suggests the open lighting petition with the same recipient; open it, or tap **Mine is different, keep writing**. Write a specific problem and action. Apply the **simulated AI** suggestion, undo it, or edit it. Continue and enter the recipient, summary, city, goal, future deadline, and optional labeled HTTPS evidence.
5. Choose `email` for private eligibility and allow `anonymous` publicly. Review the card and full text. Confirm publishing. The new petition appears in Home and Profile → Created. You can save incomplete drafts from any step and resume them from Profile. Previously created petition drafts remain publishable from Manage.
6. Manage the petition: post an update, edit its title/action with a public explanation, and inspect History. Add Sam as collaborator in the local demo. After a signature, eligibility and public identity rules are locked.
7. Switch to Sam, open the ripple link Maya copied in step 3 and sign the flagship through it — Maya's bell now says **Your ripple grew**, without naming Sam. Then sign the new petition anonymously, add a structured discussion contribution, join Riverton students, and post in its community conversation. Then switch to Maya and open **Safer crossings for smaller footsteps**, a members-only Riverton students petition: Sam and Jordan have already voted for the community to back it, so Maya's **Yes** makes three. It now shows **Backed by Riverton students** on its card, page and community page, the packet lists the vote, and Sam is notified. Back as Maya, Manage the flagship: **Signatures, last 14 days** shows today's real signatures by source (Sam's under Share links, Maya's own under Community members); tap a day for its breakdown.
8. For custom verification, switch to Jordan, open **Bring the courts back to life**, submit a non-sensitive eligibility statement. Switch to Sam → Manage → approve the request. Switch back to Jordan and sign anonymously.
9. Report a concern (quick picks: spam, offensive or hateful content, threats or harassment), confirm it, and read the automatic-check result; then find the private report in Profile and submit an appeal. Responses entered in Manage remain **unverified** and receive no official styling.
10. Follow the loop back. As Jordan, **Save** the flagship petition without signing it, switch to Maya, post an organizer update, then switch back to Jordan and open the bell: saving is how you follow a petition. Organizers see the other direction — Maya's notifications list Sam's signature (as **Anonymous supporter**, never by account name), the community backing, the discussion post, and any waiting eligibility request.
11. Revise a published petition. Maya → Manage → **Edit transparently** now edits every content field — summary, problem, recipient, location, goal, deadline and sources — not just title and action. Change the recipient and the goal, read the pending-changes line, confirm, and check the before/after wording in **History**. Signing rules stay locked because signatures exist; topic and community are fixed for every published petition.
12. Withdraw and retract. On a petition Sam signed, open **Change your mind** and withdraw: the count drops, the public supporter row goes, the drawn signature is deleted, and it leaves any ripple it was part of. Remove one of your own discussion posts and watch it become a visible “removed by its author” note rather than a gap.
13. Create and moderate a community. On **Riverton students**, **Start a petition here** opens Create with that community and city chosen. As its owner Maya, post an announcement; members such as Sam see it in their bell as **Your community**. Communities → **Create a community**; you become owner and first member, with a headcount carrying no fictional padding. Appoint a member as moderator and retract a post as owner. Then Manage → close a petition and **Archive permanently**: it leaves every feed, search result and profile, including your own.
14. Profile → Simulate next write failure. Try saving or signing an unsigned petition. The temporary optimistic change rolls back with an actionable error. Retry succeeds. Reload the browser to verify persistence.
15. On the web, Manage the flagship → **Print a poster**. The poster shows the title, the request and its recipient, and a QR code for the petition's address on the site that printed it. On a deployed site anyone who scans it lands on the petition; a `localhost` address only opens on the computer running the demo. After Maya signs a petition, its poster code carries her ripple link.

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

Jest + React Native Testing Library cover ranking/diversity, deterministic AI, form validation, identity/eligibility combinations, permission-sensitive rendering, creation/publishing/signing, duplicate signatures under concurrent attempts, persistent state, custom approval, immutable rules, actual TanStack optimistic rollback, notification fan-out and its anonymity guarantee, milestone crossing, full-field revision with locked audience fields, signature withdrawal, rolling velocity, community creation and moderation, community backing votes, post tombstones, archival, report withdrawal, drawn-signature validation, and ripple attribution (direct and further counts, loops, self-links, unknown codes, withdrawal, anonymity). `test:db` runs the real migration and repeatable seed in embedded PostgreSQL (PGlite), then exercises RLS, write denial, drafts, command permissions, eligibility, public anonymity, reports, and the recursive ripple query. This does not replace staging tests of Clerk JWT issuance or Supabase hosting.

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

**For You** (`src/domain/for-you.ts`) starts from a base score a new account sees: 35% interests, 30% same approximate city, 20% joined community (a petition your community voted to back counts as its own), 10% freshness/activity, and 5% capped community backing. Behaviour is layered on top as content-based filtering over implicit feedback: signing (5), volunteering (4), swiping right, saving or sharing (3), discussing (2), reading for 20+ seconds (1.5), opening (1) and passing (-2) each vote for the features of that petition: its hidden tags, topic and community. Tags are written by Claude from the petition's wording and steered toward a shared vocabulary so related petitions match; until a petition is tagged, word matching stands in (`src/domain/tags.ts`). Logged votes halve every 14 days. Candidates are scored by cosine-style match against that taste profile; behaviour can move a card up to 60 points either way and gains say with evidence (half weight at 8 weighted actions), so a new account sees only the base score. A greedy diversity pass avoids three consecutive cards from one topic/community, and once behaviour is steering, every fifth card is a neutral one ("Something different from your usual"). Cards explain themselves by naming a petition you acted on, never the hidden tags. Opens, reading time, swipes and shares are stored only on the device (`src/data/signals.ts`); signatures, saves and volunteering are server records. The Profile toggle turns all behavioural ranking off and stops logging, and the history can be cleared. Trending caps signature velocity, saves, and discussion activity and discounts tiny samples. No political affiliation is inferred. The visible AI completeness rubric is deterministic, editable, and never claims to establish truth.

See [DECISIONS.md](DECISIONS.md) for privacy and engineering tradeoffs.

## Hosted Supabase + Clerk

Browsing is public: opening `/` lands on Home without requiring login. Guests have separate **Log in** and **Sign up** buttons across the five tabs. Authentication uses a fluid two-column layout on desktop (900px and wider) and a full-width, stacked, scrollable layout on smaller screens, without a fixed page-width cap; signing, saving, publishing, and membership still require an account. The registration button opens Clerk’s sign-up flow directly, and **Back to browsing** returns to Home.

The app keeps Clerk for authentication and uses Supabase for persistent data through the existing typed RPC adapter. There is no second Supabase Auth session. Setup errors render an actionable screen instead of silently switching to fictional data. Queries wait for Clerk hydration, and every Clerk session owns a separate TanStack Query cache, including private manager queries.

**Setting up a live deployment:** follow [SETUP.md](SETUP.md). It creates a fresh Clerk application and Supabase project, sets the session-token claims (`role`, `email_verified`, `name`), pushes the migrations, deploys the Edge Functions and publishes the website on Vercel as a public beta (`vercel.json`; `npm run preview:web` builds and serves the identical site locally). The fictional seed is never pushed to a live project; a migration adds its petitions and communities as labelled examples instead (see below).

The snapshot RPC refreshes each person's private record from their signed Clerk token on every load: `email_verified` (when the claim is present) and, while it is still the placeholder `Community member`, their display name. Grant real community ownership/moderator roles through trusted provisioning, and provision production collaborators administratively in `petition_collaborators` rather than through the demo's fictional picker.

Regenerate matching relational row types from the migration with `npm run types:db`, then run `npm run format`.

The typed RPC boundary includes `lookaware_snapshot`, `lookaware_command`, `lookaware_requests`, `lookaware_community_posts`, `lookaware_community_reports`, `lookaware_volunteers`, and the owner-only `signature_receipt`. Every exposed table has RLS. Direct client writes are revoked; commands take identity from the validated JWT, enforce ownership/eligibility, and lock the petition row while signing. A database unique constraint enforces one `(petition_id, user_id)` signature. Private profiles, reports, and verification mappings never enter public signature payloads. SQL security-definer functions pin an empty search path and explicitly restrict execute grants.

**Trusted operations:** real official-response verification, email/location approval, report decisions, final appeal review, and discretionary badge awards must run server-side. No client route can grant these powers. First voice, Showing up, Community builder, Change starter, and Conversation starter are awarded transactionally from confirmed activity; profile editing cannot grant badges. The fictional verified response is clearly labeled in both seed data and the UI.

## Federal rules open for comment

Home and Explore show real U.S. federal proposals that are open for public comment, fetched in the app from the [Federal Register API](https://www.federalregister.gov/developers/documentation/api/v1) (public, no key). `src/domain/federal.ts` keeps proposed rules from agencies that match the app's topics (for example NHTSA to Safer streets, EPA to Environment, National Park Service to Public spaces, disability-access rules to Accessibility), drops routine notices such as airworthiness directives and state air-plan approvals, accepts only `federalregister.gov` and `regulations.gov` links, and ranks your interests first, then the soonest deadline. Each card opens `federal/<document number>` with the official summary, the agency and the deadline. **Comment on Regulations.gov** leaves the app after a confirmation; comments are written and sent on the government site. Federal rules cannot be signed or saved in Swipe4Change, and the section hides itself when offline.

## Accounts in the live app

A new account first answers **How do you want to take part?** (Organizer, Supporter or Community builder). The choice only picks the three-screen welcome tour shown after onboarding (`app/tutorial.tsx`): organizers see how to write, address and run a petition and land on Create; supporters see swiping, signing privacy and following and land on Home; community builders see groups, private backing votes and community spaces and land on Groups. Every role can do everything in the app. The role shows on the Profile ribbon, can be changed in Profile and privacy, and the tour can be replayed from there.

**Profile pictures.** Tap the avatar on Profile (or open Profile and privacy) to add, change or remove a picture. It is resized to 320 px and its metadata stripped on the device, then stored as a small JPEG on the person's own profile row (migration `202610200002_profile_photo_role.sql`). Profiles are readable only by their owner, so only the person sees their picture: on Profile, in the Home header and in the desktop sidebar. Deleting the account clears it.

Onboarding asks for a display name and a required "I'm 13 or older and agree to the Terms and Privacy Policy" checkbox linking the plain-language [Terms and Privacy page](app/legal.tsx). Profile → **Delete account** (live mode only; type `DELETE` to confirm) removes the person's petition photos, then their signatures, saves, memberships, interests, drafts, volunteering, reports, notifications, badges and Clerk mapping (`delete_account`), archives the petitions they own, keeps public updates and posts under "Deleted account", and finally deletes the Clerk user. The fictional sample cities, the fictional recipient directory and the simulated location rule appear only in the demo.

## Scope and limitations

- The fully working competition flow uses a local device adapter. Hosted RPCs are exercised in PostgreSQL, but live Clerk/Supabase credentials, external webhooks, native device signing, and EAS builds require your accounts/tooling.
- Demo accounts and approvals are deliberate simulations. Local storage is not an authorization boundary for hostile users; Supabase is the production boundary. Do not enter real personal or sensitive data in the local demo.
- The app stores only `City, ST`, never coordinates or an address. The city picker searches Open-Meteo's free geocoder; **Use my current location** reads one low-accuracy position, rounds it to two decimals (about 1 km) and asks OpenStreetMap Nominatim for the city, then discards it. Both services are free and keyless; Nominatim's policy allows occasional single lookups like this but not bulk use. Cities compare through `sameCity` (`src/domain/location.ts`), which ignores case, punctuation and spelled-out state names. "Near" still means the same city, not a radius. No contact details or authentication subjects are projected into public records. Creator-supplied free text must not contain private information; production needs moderation, rate limits, and abuse controls.
- Report review and hidden tags use Claude (`claude-opus-5`, low effort, structured output, server-side refusal fallback) via `supabase/functions/_shared/civic-ai.ts`. Only a petition's public wording is sent: never the reporter, their reason, signers or anything about the viewer. The model can be wrong, so a flag only hides the petition until a trusted person decides; restoring one is an admin operation (`update public.petitions set hidden=false`). When the model is unreachable, reports fall back to keyword rules (`supabase/functions/_shared/civic-rules.ts`) that catch only obvious abuse. Each review is a paid API call; there is no per-user report limit yet.
- The demo's `/api/ai` route has no auth or rate limit, so it runs only on the development server (it returns 404 in a production build). Hosted deployments use the Edge Function.
- For You history is per device, so a second device starts from signatures, saves and volunteering only.
- Official verification and report/appeal review have no live staffed service. An organizer can record an **unverified** response, not verify an official. A reporter can withdraw their own report; the `reviewed` state is reserved for trusted server-side review that does not exist here. Real badge/admin operations need audited trusted infrastructure.
- Community moderation covers post retraction only. Owners appoint moderators from actual members, and the demo picks them from the three sample accounts. Member removal, banning, and production moderator invitations are deliberately absent: they need an appeals process this prototype cannot staff.
- Notifications are in-app only. Everyone who signed, saved or volunteered for a petition hears about its updates, material edits, signature milestones, recorded responses and closure; organizers hear about signatures, endorsements, discussion and eligibility requests. There is no push delivery, email, or digest.
- Evidence uses labeled HTTPS links, not uploaded files. There is no map, background digest, push delivery, realtime subscription, advanced residency verification, or draft collaboration. Expo Notifications is configured for a later opt-in notification flow; no permissions are requested now. Optional map and these P2 features are outside this vertical slice.
- Snapshot reads favor a dependable small demo. Production needs pagination, indexed search, batched public aggregates, realtime invalidation, and load testing. Fictional activity counters are clearly identified and must not be used for live communities.
- Native share uses the platform sheet. Web copies the petition URL with a visible confirmation. Native sharing uses the `swipe4change://` deep link; set your deployed web origin instead if recipients should also open links in a browser. Local demo data stays on the originating device. Web hosting must serve `index.html` for deep-link fallback because the Expo export is a single-page app.
- Accessibility uses 44+ point controls, semantic labels, high-contrast tokens, natural text scaling, reduced-motion support for swipe animations, keyboard focus through native web controls, and responsive layouts. VoiceOver/TalkBack testing on real devices remains necessary before release.

## Discovery, writing, and profile updates (September 10)

Home is a single-card swipe deck reading three directions: right supports (opening the signing sheet, never signing), left passes, up opens the full page. The card sits centered with no buttons under it: tapping it opens the full page, screen readers get Read, Pass, Sign and Save as actions on the card, and on the web the focused card takes ← to pass, → to sign and ↑ or Enter to read, so the deck is fully usable without dragging. Passing is reversible and never signs. Already-signed petitions are omitted from the deck. Saved retains a browsable grid. Explore lists compact rows on phones - a 98-point image column beside title, location, days left and progress - and the same grid at 760 points and wider; its sections are Trending, Near you, Recently updated, Ending soon and Saved. Topic filters scroll horizontally on phones; desktop uses a 220-point navigation rail and supplementary community panels.

Profile supports display name, a 280-character bio, an initials avatar, participation counts, your ripple, earned badges with visible criteria, an opt-out for activity personalization, and a button that clears on-device reading and swiping history. Changing a display name does not rewrite historical signatures.

The simulated AI suggests a recipient category from the topic, issue text, and approximate city. It never fills the actual recipient field or fabricates an office. Creators choose an office or enter one after confirming its jurisdiction. The assistant structures supplied observations into a request with a response deadline, offers reversible title/summary/body improvements, and provides relevant official research links. These are research starting points, not claims that a statute applies. Current references: [DOJ Title II guidance](https://www.ada.gov/topics/title-ii/) and [EPA Clean Water Act overview](https://www.epa.gov/laws-regulations/summary-clean-water-act). Confirm local jurisdiction and facts before relying on a legal basis.

Additional smoke checks:

- At 390px and desktop width, filter a topic, pass a card, undo the pass, and review it without signing.
- Save an incomplete petition, switch accounts to confirm privacy, return to resume it, then publish the completed draft.
- Edit a bio; reload; toggle activity personalization off and confirm the feed shows no "Like ..." reasons.
- Open and sign a petition, return Home, and confirm related petitions (including other topics) rise with a "Like ..., which you signed" reason.
- As Sam, create a petition calling people idiots; as Jordan, report it and confirm it disappears; as Sam, confirm the hidden notice and notification.
- Sign, then edit the petition as its organizer: **Your signature** still shows the text you originally read.
- Open a ripple link as Sam, go Home, then return to the petition without the link and sign: the credit still reaches the sharer. Withdraw and watch the ripple shrink.

## Visual theme

Tokens come from the v3 design, which keeps the original palette: canvas `#EEF0E9`, near-black olive `#1C1F19` for primary buttons, the tab bar and the sidebar, sage `#899878`, pale olive `#E4E6C3`, terracotta for pass and alerts, slate blue for saved, per-topic accent/soft/emoji sets, and Plus Jakarta Sans (400, 500, 700, 800 and two italics). They live in `src/components/theme.ts` with the design's gradients (dark primary button, sage progress fill, AI border, celebration); design primitives (press-to-shrink, pills, bars, kicker, sheets, segmented control, rings, toasts) live in `src/components/kit.tsx`, and the design's line icons in `src/components/glyph.tsx` (react-native-svg). Sheets slide up on phones and become centred dialogs on desktop.

Plus Jakarta Sans is bundled through Expo Font. The fourteen illustrative photos in `assets/photos/` come from the v3 design and are bundled for offline use: twelve of the fictional seed petitions each show their own (matched by seed id in `petitionImage`), and every other petition without an organizer photo shows its topic's photo. They are illustrative, not evidence or photographs of the fictional petition locations, and are labeled accordingly. The reference’s platform statistics, legislative victories, certification promises, and donation/funding claims are not product claims. All demo data continues to be labeled fictional.

Theme smoke check: open Home and Explore at 375px, 1000px (icon rail) and 1440px (sidebar); drag the deck left, up and right, tap the photo's right and left halves to page, and press undo / pass / save / sign / share; sign a petition end to end to the "It's signed!" screen; walk Create to the published card; open Communities (join and search), a community, Profile and Notifications. Mobile primary controls should remain at least 44 points.

## Introduction

The root route now introduces Swipe4Change before continuing to the existing discovery/onboarding flow. It uses the v3 palette and Plus Jakarta Sans like the rest of the app (it briefly had its own teal and ivory theme, replaced when v3 landed). The introduction is responsive and lets visitors browse without signing in.

The web intro integrates five source components from [React Bits](https://reactbits.dev): **Blur Text** (headline), **Animated Content** (card and steps), **Spotlight Card** (illustrated cause card), **Count Up** (step numbers), and **Star Border** (browse button). Source and upstream license live in `src/components/react-bits/`; Motion and GSAP are dependencies. Upstream source is exempt from app-specific inline token checks. Native uses a matching React Native introduction rather than DOM components. System reduced-motion preferences are supported. Illustration and copy are conceptual, not live petition or signature statistics.

Preview without hosted credentials: `EXPO_PUBLIC_BACKEND=demo npm run web`. Smoke check the intro at 390px and 1440px, use the browse button, open a petition, and verify keyboard focus and reduced motion. The introduction reappears when the root route mounts; deep links remain direct.

The fictional catalog now contains **22 petitions** across the five existing topics and four communities. Ten additional requests cover shaded bus stops, a repair cafe, homework sessions, step-free recreation routes, public seating, family preparedness workshops, rain gardens, equipment lending, quiet play space, and a maintenance calendar. New requests start at zero signatures, saves and volunteer activity, with no fabricated endorsements or official responses. `npm run seed` regenerates the repeatable Supabase development seed from the same typed factory. As described in SETUP.md, do not import the fictional seed into a real community database.

**Examples on the live site.** A new live project would open empty, so migration `202610200001_example_petitions.sql` adds the fictional catalog (22 petitions, four communities, their organizers, updates and one fictional official response) without the seed's badges, with deadlines 60 days later than the seed's. They keep the seed's reserved ids, and the live app labels them: an **Example petition** badge on swipe cards, **Example** on tiles and rows, a notice on the petition page, "Example" in the Communities list and the fictional-community note on community pages. Real petitions cannot be filed into example communities. Anyone can still sign an example; it sends nothing anywhere. Archive them with the two statements at the top of the migration once real petitions fill the feed.
