# Swipe4Change — Feature List

Current as of October 12, 2026. Every account, community, office, signature and response in the demo is fictional.

**At a glance:** one Expo / React Native app for iOS, Android and web · works fully offline as a local demo with three sample accounts · switches to a real Supabase + Clerk backend with one environment variable · 200 unit and UI tests and a PostgreSQL integration test.

---

## 1. Getting started

- **Welcome screen** with three demo accounts (Maya the student organizer, Sam the approved local resident, Jordan the new member) — no password needed.
- **Explore first:** browse every public petition as a guest before signing in.
- **Real sign-in** through Clerk (email or Google) when the Supabase backend is enabled; see [SETUP.md](SETUP.md).
- **Onboarding:** your display name, at least three interests (or skip) and your city, plus a required “I’m 13 or older and agree to the Terms and Privacy Policy”. An exact address is never asked for.
- **Plain-language Terms and Privacy** page describing exactly what is stored.
- **Real city picker:** type-ahead search of real US cities, or **Use my current location** once. Only "City, ST" is saved — the position is rounded to about a kilometre, used for one lookup and discarded. In the demo only, the fictional towns are offered as labelled sample cities.
- **Deep links** open any petition or community directly (`swipe4change://`, with the old `lookaware://` still working).

## 2. Discover petitions

**Home is the swipe deck**

- Greeting with the number of active causes near your city, and **Change** opens the city picker in place.
- **Swipe deck** on every screen size — right to sign (opens the signing review; only your confirmation records a signature), left to pass, up to read more. The card sits centered with no buttons under it: tap it to read, screen readers get Read, Pass, Sign and Save as card actions, and the web keyboard uses ← → ↑. Passes can be undone, and a first-run tip explains the gestures. When you run out, **Explore more** takes you to Explore.
- **Swipe feel** ✦ new — a quick flick commits a short swipe, a cancelled drag springs back, and on phones a light tick marks the moment a drag crosses its line. Saving taps and a confirmed signature buzzes.
- **Why these?** shows the exact ranking recipe as a table.

**Explore holds every other way to find petitions**

- While browsing (no search or filters): the live ticker, the **local spotlight**, collections (**Near you**, **A milestone within reach**, **Gaining momentum**), then **All petitions** as cards.
- Searching or filtering shows only the matching results.
- Full-text search across petitions and communities, with topic chips and quick filters (near you, updated this week, ending within 30 days).
- **Filter sheet:** approximate city, signing requirement, recipient level of government, community, deadline and recent updates. Unapplied edits can be cancelled; filters clear in one tap.
- Every result says why it matched. Phones get compact rows; wider screens get a grid.
- **Federal rules open for comment** ✦ new: real U.S. proposals from the Federal Register on topics like road safety, the environment and parks, ranked by your interests and deadline. Each opens the official summary and a link to comment on Regulations.gov (after a leaving-the-app warning). Also on Home.
- **Find your people:** community suggestions, your community's latest activity and a “start a petition” prompt at the foot of the page.

**For You: a feed that learns from what you do** ✦ new

- **Base score** for a new account: 35% interests · 30% approximate location · 20% joined communities (including petitions your community voted to back) · 10% recency/activity · 5% community backing.
- **Behaviour on top:** signing, volunteering, swiping right, saving, sharing, discussing, reading for a while and opening each count toward "more like this" (strongest first); passing counts against. Older activity fades (two-week half-life).
- **Hidden hashtags by AI:** Claude tags every petition from its wording (lighting, bus stops, campus, libraries…), reusing a shared vocabulary so related petitions match, and retags it when the wording changes. The feed learns specific issues across topics. Tags are never shown; word matching stands in until a petition is tagged.
- Activity can move a card up to 60 points and earns more say the more you use the app. Each card says why it is there ("Like “…”, which you signed").
- A diversity pass stops one topic or community from taking over, and every fifth card is something different from your usual.
- Trending uses a rolling seven-day window of signatures, saves and discussion, and discounts tiny samples.
- No political profiling. Reading and swiping history stays on your device; activity personalization can be switched off and cleared in Profile.

## 3. The petition page

- Topic, city and status, title, requested action, creator, community and recipient.
- The story in three parts: **the problem**, **how we propose to solve it**, and **who can make this change**.
- **Who decides this?** — the recipient's level of government and usual response time, linked to the recipient directory; for a real elected official, their office, district, phone and website or contact form.
- Progress bar, sample-vs-real signature disclosure, and the next milestone.
- **Story / Progress / Activity** tabs:
  - **Story:** the change requested, why it matters, and the organizer's labelled sources.
  - **Progress:** milestones, the delivery record, and recorded responses with their verification status.
  - **Activity:** organizer updates, the structured discussion (question / idea / experience), community backing and public edit history.
- **Save** (saving is following), **Share**, **Volunteer**, **Donate** (when the organizer linked a fundraising page), **Report a concern**.
- **Print a poster** ✦ new (web) — a printable poster with the title, the requested change, its recipient and a QR code that opens the petition. Once you have signed, the code carries your ripple link, so poster signatures count in your ripple.
- **Spam filter at publication:** every petition is checked by Claude as it is published and whenever its wording changes, for spam, threats, insults, hateful language and nonsense (gibberish, test posts, jokes with no request). Flagged petitions are saved but held out of public view with the reason; editing the wording rechecks it and clean wording goes public. Keyword rules decide when the model can't be reached. Blunt or angry civic speech stays up.
- **Verified email to publish:** saving drafts needs none; publishing does, which keeps throwaway accounts from flooding the app.
- **AI report review:** reporting sends the petition's wording (never the reporter or their reason) to Claude. If it finds spam, threats, insults, hateful language or nonsense, the petition is hidden from the public until a person reviews it; otherwise it stays up and the report waits for a reviewer. Reports can't hide a clean petition. Keyword rules take over if the model can't be reached.
- “N signed because a supporter shared it” when shares are working.
- The latest public supporter names, exactly as each signer chose to appear.
- A **sticky Sign bar** on phones once the main button scrolls away.
- A banner when you arrive through someone's share link.

## 4. Signing

- **Three steps on one sheet:**
  1. Read the exact petition text, recipient, location and deadline, with a live eligibility check.
  2. Choose how you appear, previewing the exact public name each option produces.
  3. **Draw your signature** and tick a consent box that starts unchecked.
- **Five eligibility modes** set by the organizer: signed-in account, verified email, community member, approved location, or a custom rule the organizer reviews.
- **Three public identity modes:** full name, first name + last initial, or anonymous. You can be privately verified and publicly anonymous.
- **Your signature:** only you can see your drawing and the exact text you signed, even after the organizer edits the petition.
- If the organizer changes the text while you're reading, the signature is refused and you're asked to reread it.
- **One signature per person,** enforced by the database.
- The count updates instantly and rolls back with a clear message if the write fails.
- **Withdraw any time:** the count drops, your public name disappears, and your drawing is deleted.
- **Custom eligibility requests:** send a short, non-sensitive statement; the organizer approves or declines it.

## 5. Ripple — see the change you started ✦ new

- After you sign, **Share my link** copies a link carrying your private ripple code.
- Everyone who signs through it joins your ripple, and so does everyone who signs through their links.
- **Rings around “You”** show how many signed through you and how many more through them, animated once your ripple starts to spread (still for reduced-motion users).
- Shown on the petition page, on your profile (total, plus a breakdown per petition) and right after you sign (“Now start a ripple”).
- A **“Your ripple grew”** notification when someone signs through your link.
- Organizers see how many real signatures came through supporter links.
- **Privacy rules:** counts only, and nobody is ever told who signed through their link. Only people who signed can earn credit. Bad, stale or self-links are ignored and never block a signature. Withdrawn signatures leave the ripple. Open a link, browse away and sign later, and the sharer is still credited.

## 6. Creating a petition

- Start from a **template** or a blank page.
- **Four steps:** Define the change → Build the case → Configure participation → Review and publish.
- **Write it for me ✦ (AI):** describe what's wrong in your own words — any language, or by dictation — and Claude drafts the title, summary, problem, requested change and topic. It never invents facts, numbers, names or sources; when something important is missing it asks up to three questions instead. Every field stays editable and **Undo AI draft** restores yours.
- **Writing check** (local rules, clearly labelled):
  - A 0–100 quality score with a visible rubric.
  - Missing-piece flags: recipient, action, location, deadline, evidence, measurable outcome.
  - Suggested titles and summaries built from your own fields, applied in one click and reversible.
  - A suggested recipient _category_ — it never fills in an office for you.
  - Official research starting points by topic.
- **Plain-language check:** reading grade level against a grade-9 target, plus flags for passive voice, vague verbs and asks with no number or date. Advisory only; never blocks publishing.
- **Your elected officials:** for a real city, the two U.S. senators, the House member and (with an Open States key) the state senator and representative, one tap to address the petition to any of them. Party is never shown.
- **Find the right recipient ✦ (AI):** Claude searches the web for the office that can actually make the change — a city department, a school board, a legislator — and shows why, public contact details and its sources. Sources it did not really find are dropped; it only suggests, and **Use this** fills the field.
- **Recipient directory suggestions** for the fictional sample cities, ranked by topic and wording.
- **Participation rules:** eligibility mode, custom rule text, and which public identities signers may choose.
- **A photo of the problem:** take or choose one, with a required description for screen readers. It replaces the stock topic image on every card and on the petition page. Location and other metadata are stripped on the device before upload.
- **Card and full-page previews** before a publish confirmation.
- **Private drafts:** save from any step, keep several, and resume or delete them from Profile.
- **Already started?** ✦ new — while you define the change, and again before publishing, Create shows up to three open petitions that look like the same ask: same city or office, the same issue, and shared place names like a street or campus. Open one to sign or help instead of splitting supporters, or tap **Mine is different** to hide them. Advisory only, never blocks publishing, and uses fixed rules rather than AI.

## 7. Organizer dashboard (Manage)

- **At a glance:** progress, update/discussion counts, how many communities back it, and how many signatures came through supporter shares.
- **Signatures, last 14 days** ✦ new — a daily bar chart of real signatures, split into share links, community members and everyone else, with this week against the week before. Tap a day for its breakdown. Counts only: organizers never see who signed how, and fictional sample signatures are not charted.
- Publish a saved draft.
- **Collect signatures in person** ✦ new — print the QR code poster (web).
- **Delivery:** preview the delivery packet, then record how and where it was sent (email, online portal, in person, posted mail).
- **Volunteer roster:** names, chosen roles and notes; organizer-only, with no contact details.
- **Donation link:** optionally link your own external fundraising page; every change is public edit history.
- **Organizer updates** that notify everyone following.
- **Edit transparently:** revise any content field with a public explanation; the old wording goes into public history and followers are notified. Signing rules lock after the first signature; topic and community never change.
- **Eligibility requests:** approve or decline custom-rule requests.
- **Record responses** as unverified, linked to the delivery they answer. Only a trusted administrator can mark one verified.
- **Collaborators** who can edit and post updates (demo picker).
- **Close, mark successful, or archive:** archiving only after a public close, and only by the owner.

## 8. Delivery and responses

- **Delivery packet:** a printable / PDF / shareable document with the petition text, requested action, recipient and level of government, sources, signature count, eligibility rule and public supporter list.
- The packet **freezes** the count and names at the moment of sending, and contains only what's already public — no contact details, and anonymous signers are counted but never named.
- **Responses** have three states: unverified, pending, verified. Only verified responses get official styling, and demo ones are labelled fictional.

- **Send it:** copy the packet, then open a member of Congress's contact form or website, or your email app addressed to the office (the request in the body, the full packet on the clipboard). The delivery record is filled in for you to confirm.
- Packets for real petitions say signatures were collected online and are not a legal ballot petition; only sample data is labelled fictional.

## 9. Recipient directory

- Fictional local offices at city, county, state, school-district and campus level.
- For each office: what it can decide, what it can't (and who can instead), and its published response time.
- Reachable from Explore, the create flow and every petition page.

## 10. Communities

- Browse, join or leave communities, or **create your own** — you become its owner and first member.
- **Community page:** member and campaign stats, active and completed campaigns, recent organizer updates.
- **Start a petition here** ✦ new — opens Create with the community and its city already chosen, as a fresh draft.
- **Workspace zones:**
  - **Discussion:** members post questions, ideas and experiences, with optional topic channels.
  - **Announcements:** posted by the owner and moderators in the community's voice.
  - **Events:** date and place, soonest first.
  - **Organizer space:** a private room only moderators can read.
  - **Campaign updates:** a read-only feed of the community's petition updates.
  - **Reports:** the moderator queue.
- **Moderation:** owners appoint moderators from real members. Removed posts leave a visible “removed” note instead of a gap. Reporting a post never reveals who reported it.
- **Community backing by member vote:** on any active petition, members of each community you belong to vote yes or no on whether the community backs it. Three yes votes with more yes than no back it, and the vote closes. Backing shows as **Backed by …** on the swipe card, petition page and community page, goes into the packet sent to the recipient with its tally, ranks the petition as the community's own for its members, and notifies the organizers. Only totals and your own vote are ever shown.
- **Members-only petitions:** a petition that only community members can sign says **Members of … only** on its card, and each community page lists them with a join prompt. Community cards show how many members-only and backed petitions each community has.
- Community pages group petitions into **Members-only**, **Up for a vote**, **Backed by …** and **Active campaigns**.

## 11. Notifications

- An in-app inbox for everything that happens on petitions you **saved, signed or volunteered for**: organizer updates, material edits, milestones (25/50/75/100%), deliveries, recorded responses, closures.
- Organizers also hear about new signatures (by the public name the signer chose), community backing, discussion, volunteer offers and eligibility requests.
- Plus ripple growth, moderator changes, and eligibility decisions.
- **Your communities** ✦ new — members hear about announcements and events from the people who run each community they joined, and about each new campaign once, the first time it is actually public (never while the spam check holds it). A member's own event and the private organizer room notify no one.

## 12. Profile

- Initials avatar, name, city and bio.
- **Stats:** Started, Signed, Ripple, Communities.
- **Badges** earned from real activity: First voice, Showing up, Community builder, Change starter, Conversation starter — with visible progress toward each.
- **Your ripple** summary.
- Participation filters: Created, Signed, Saved, Volunteering.
- Your communities, your private drafts, and profile editing (name, bio, signing-history personalization toggle).
- Interests and approximate location, and the status of the private email/location checks.
- **Your reports and appeals:** see the automatic check's result, add an appeal, or withdraw it.
- **Delete account** (live app): removes your personal records and photos, takes your petitions out of public view, and deletes your sign-in.
- **Demo controls:** simulate a failed write to see rollback, or reset all demo data.

## 13. Trust, privacy and safety

- Eligibility checks and public identity are separate choices.
- Organizers and the public never see emails, phone numbers, exact addresses, verification evidence or login identifiers.
- Exact signing times are never public, so anonymous signers can't be matched by timing.
- Every material edit is public, with the previous wording.
- Milestones, closures and “successful” are labelled as organizer reports, not verified outcomes.
- All sample data is labelled fictional throughout the app.
- No in-app payments, political fundraising, political profiling or campaign branding. Donate only opens an organizer's own page, after a leaving-the-app warning.

## 14. Accessibility and design

- 44-point minimum touch targets, semantic labels and screen-reader text, and support for large system text.
- Reduced-motion support for the swipe deck, progress animation and ripple rings.
- Keyboard-usable on web: the focused swipe card takes ← to pass, → to sign and ↑ or Enter to read.
- Responsive layouts from 320-pixel phones to desktop, with phone-specific layouts below 760 points.
- A shared design system: sage/olive civic palette, Newsreader headings, Work Sans body text, one 12-step type scale, seven corner radii and named colours, kept that way by a test. One line-icon set throughout, with no emoji standing in for icons.
- Haptic feedback on phones (swipe commit line, save, confirmed signature); none on the web.
- Friendly empty, loading and error states, and confirmation before signing, publishing, reporting, closing or archiving.

## 15. Under the hood

- **Stack:** Expo SDK 57, React Native 0.86, React 19, strict TypeScript, Expo Router, TanStack Query, React Hook Form + Zod, Clerk, Supabase, and the Anthropic SDK (Claude) on the server only.
- **Two backends, one contract:** a persistent offline local adapter and a Supabase RPC adapter share the same typed commands, so the whole app runs either way.
- **Database:** row-level security on all 24 exposed tables with default-deny, writes only through authorized functions, row locks while signing, and a database-level unique signature constraint. A recursive query computes ripples and returns counts only.
- **Tests:** 200 unit and UI tests across 41 suites; a PostgreSQL integration test (PGlite) that runs every migration and the seed, then exercises permissions, privacy and the ripple rules.
- **Repeatable seed:** 12 petitions across 5 topics and 4 communities, from one typed factory shared by the demo and the SQL seed.

## Deliberately not included

- Legal ballot-measure collection (voter-registration matching, circulator affidavits, notarization) — the drawn signature is not a legally certified signature.
- In-app payments or fundraising (donations are an external link only).
- Push notifications, email or daily digests (in-app only for now).
- Maps, file uploads beyond one petition photo, real-time updates, and bot detection.
- Generative AI in the writing check's score and tips (Claude is used for the petition writer, the sourced recipient finder, the publication spam check, report review and hidden tags).
- Automatic photo screening (photos are covered by reports).
