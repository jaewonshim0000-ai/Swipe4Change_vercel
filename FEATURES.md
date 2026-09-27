# Swipe4Change — Feature List

Current as of September 27, 2026. Every account, community, office, signature and response in the demo is fictional.

**At a glance:** one Expo / React Native app for iOS, Android and web · works fully offline as a local demo with three sample accounts · switches to a real Supabase + Clerk backend with one environment variable · 91 unit tests and a PostgreSQL integration test.

---

## 1. Getting started

- **Welcome screen** with three demo accounts (Maya the student organizer, Sam the approved local resident, Jordan the new member) — no password needed.
- **Explore first:** browse every public petition as a guest before signing in.
- **Hosted sign-in** through Clerk when the Supabase backend is enabled.
- **Onboarding:** pick at least three interests (or skip) and an approximate city/state. An exact address is never asked for.
- **Deep links** open any petition or community directly (`swipe4change://`, with the old `lookaware://` still working).

## 2. Discover petitions

**Home**

- Greeting with the number of active causes near your city, and a quick **Change location**.
- **Local spotlight** featuring the flagship petition, its progress, next milestone and latest update.
- **Swipe deck** — right to support (opens the signing sheet; a swipe never signs), left to pass, up to read more. Every gesture also has a labelled button, passes can be undone, and a first-run tip explains the gestures.
- **Card view** toggle for a grid instead of the deck.
- **Why these petitions?** shows the exact ranking recipe as a table.
- Collections: **Near you**, **Recently updated**, **A milestone within reach**, **From your communities**, **Gaining momentum** (trending), plus community activity cards and a “start a petition” prompt.

**Explore**

- Full-text search across petitions and communities, with topic chips and quick filters (near you, updated this week, ending within 30 days).
- **Filter sheet:** approximate city, signing requirement, recipient level of government, community, deadline and recent updates. Unapplied edits can be cancelled; filters clear in one tap.
- Every result says why it matched. Phones get compact rows; wider screens get a grid.
- **Find your people:** community suggestions beside the results.

**Ranking you can read**

- 35% interests · 30% approximate location · 20% joined communities · 10% recency/activity · 5% endorsements.
- A diversity pass stops one topic or community from taking over the top of the feed.
- Trending uses a rolling seven-day window of signatures, saves and discussion, and discounts tiny samples.
- No political profiling. Signing-history personalization is capped and can be switched off.

## 3. The petition page

- Topic, city and status, title, requested action, creator, community and recipient.
- **Who decides this?** — the recipient's level of government and usual response time, linked to the recipient directory.
- Progress bar, sample-vs-real signature disclosure, and the next milestone.
- **Story / Progress / Activity** tabs:
  - **Story:** the change requested, why it matters, and the organizer's labelled sources.
  - **Progress:** milestones, the delivery record, and recorded responses with their verification status.
  - **Activity:** organizer updates, the structured discussion (question / idea / experience), community endorsements and public edit history.
- **Save** (saving is following), **Share**, **Volunteer**, **Report a concern**.
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
- **Writing assistant** (local rules, clearly labelled — no generative AI):
  - A 0–100 quality score with a visible rubric.
  - Missing-piece flags: recipient, action, location, deadline, evidence, measurable outcome.
  - Suggested titles and summaries built from your own fields, applied in one click and reversible.
  - A suggested recipient _category_ — it never fills in an office for you.
  - Official research starting points by topic.
- **Plain-language check:** reading grade level against a grade-9 target, plus flags for passive voice, vague verbs and asks with no number or date. Advisory only; never blocks publishing.
- **Recipient directory suggestions** ranked by topic and wording.
- **Participation rules:** eligibility mode, custom rule text, and which public identities signers may choose.
- **Card and full-page previews** before a publish confirmation.
- **Private drafts:** save from any step, keep several, and resume or delete them from Profile.

## 7. Organizer dashboard (Manage)

- **At a glance:** progress, update/discussion/endorsement counts, and how many signatures came through supporter shares.
- Publish a saved draft.
- **Delivery:** preview the delivery packet, then record how and where it was sent (email, online portal, in person, posted mail).
- **Volunteer roster:** names, chosen roles and notes; organizer-only, with no contact details.
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

## 9. Recipient directory

- Fictional local offices at city, county, state, school-district and campus level.
- For each office: what it can decide, what it can't (and who can instead), and its published response time.
- Reachable from Explore, the create flow and every petition page.

## 10. Communities

- Browse, join or leave communities, or **create your own** — you become its owner and first member.
- **Community page:** member and campaign stats, active and completed campaigns, recent organizer updates.
- **Workspace zones:**
  - **Discussion:** members post questions, ideas and experiences, with optional topic channels.
  - **Announcements:** posted by the owner and moderators in the community's voice.
  - **Events:** date and place, soonest first.
  - **Organizer space:** a private room only moderators can read.
  - **Campaign updates:** a read-only feed of the community's petition updates.
  - **Reports:** the moderator queue.
- **Moderation:** owners appoint moderators from real members. Removed posts leave a visible “removed” note instead of a gap. Reporting a post never reveals who reported it.
- **Community endorsements:** a community owner can endorse a petition on the community's behalf.

## 11. Notifications

- An in-app inbox for everything that happens on petitions you **saved, signed or volunteered for**: organizer updates, material edits, milestones (25/50/75/100%), deliveries, recorded responses, closures.
- Organizers also hear about new signatures (by the public name the signer chose), endorsements, discussion, volunteer offers and eligibility requests.
- Plus ripple growth, moderator changes, and eligibility decisions.

## 12. Profile

- Initials avatar, name, city and bio.
- **Stats:** Started, Signed, Ripple, Communities.
- **Badges** earned from real activity: First voice, Showing up, Community builder, Change starter, Conversation starter — with visible progress toward each.
- **Your ripple** summary.
- Participation filters: Created, Signed, Saved, Volunteering.
- Your communities, your private drafts, and profile editing (name, bio, signing-history personalization toggle).
- Interests and approximate location, and the status of the private email/location checks.
- **Your reports and appeals:** follow a report, add an appeal, or withdraw it.
- **Demo controls:** simulate a failed write to see rollback, or reset all demo data.

## 13. Trust, privacy and safety

- Eligibility checks and public identity are separate choices.
- Organizers and the public never see emails, phone numbers, exact addresses, verification evidence or login identifiers.
- Exact signing times are never public, so anonymous signers can't be matched by timing.
- Every material edit is public, with the previous wording.
- Milestones, closures and “successful” are labelled as organizer reports, not verified outcomes.
- All sample data is labelled fictional throughout the app.
- No payments, donations, fundraising, political profiling or campaign branding.

## 14. Accessibility and design

- 44-point minimum touch targets, semantic labels and screen-reader text, and support for large system text.
- Reduced-motion support for the swipe deck, progress animation and ripple rings.
- Keyboard-usable on web, with every swipe mirrored by a button.
- Responsive layouts from 320-pixel phones to desktop, with phone-specific layouts below 760 points.
- A shared design system: sage/olive civic palette, Newsreader headings, Work Sans body text, and centralized tokens.
- Friendly empty, loading and error states, and confirmation before signing, publishing, reporting, closing or archiving.

## 15. Under the hood

- **Stack:** Expo SDK 57, React Native 0.86, React 19, strict TypeScript, Expo Router, TanStack Query, React Hook Form + Zod, Clerk, Supabase.
- **Two backends, one contract:** a persistent offline local adapter and a Supabase RPC adapter share the same typed commands, so the whole app runs either way.
- **Database:** row-level security on all 23 exposed tables with default-deny, writes only through authorized functions, row locks while signing, and a database-level unique signature constraint. A recursive query computes ripples and returns counts only.
- **Tests:** 91 unit and UI tests across 16 suites; a PostgreSQL integration test (PGlite) that runs every migration and the seed, then exercises permissions, privacy and the ripple rules.
- **Repeatable seed:** 12 petitions across 5 topics and 4 communities, from one typed factory shared by the demo and the SQL seed.

## Deliberately not included

- Legal ballot-measure collection (voter-registration matching, circulator affidavits, notarization) — the drawn signature is not a legally certified signature.
- Donations, payments or fundraising.
- Push notifications, email or daily digests (in-app only for now).
- Maps, file uploads, real-time updates, and bot detection.
- Generative AI.
