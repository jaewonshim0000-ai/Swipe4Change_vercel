# Swipe4Change — Congressional App Challenge

**Problem:** People notice local problems but often cannot find a clear request, the responsible recipient, or a trustworthy way to participate. Petition counts alone do not tell the whole story.

**Audience:** Students, neighbors, community organizers, and people who want to contribute without making their identity public.

**Civic value:** Swipe4Change connects a concrete concern to an action, a responsible recipient, supporting sources, a community, and visible follow-through. It supports constructive local participation without campaigning, fundraising, payments, or political profiling.

**Innovation:** Private signature eligibility and public identity are two separate choices. An email-verified signer can remain publicly anonymous. The feed explains its ranking, and a deterministic simulated AI helper improves clarity without manufacturing evidence. Public edits, updates, community endorsements, and explicitly labeled responses make follow-through inspectable.

**Technical explanation:** One Expo/React Native TypeScript app runs on iOS, Android, and web. Expo Router organizes the five tabs and deep links. React Hook Form and Zod validate drafts. TanStack Query handles data, pending state, invalidation, and rollback. The persistent local adapter and Clerk-authenticated Supabase adapter share a typed command boundary. PostgreSQL uses RLS on all 20 public tables, a unique signature constraint, transactional row locks, and narrowly authorized functions. Pure domain tests and PostgreSQL integration tests exercise privacy and permissions.

## A 2–3 minute demonstration

Target: about **2 minutes 45 seconds**. Begin with fresh demo data and Maya selected. Keep a short original petition request ready to type. All names and events are fictional; say this up front.

**0:00–0:20 — Notice the problem**

“Swipe4Change turns a local concern into a clear next step. This entire neighborhood is fictional. Our flagship story follows students asking for better lighting on their walk home.”

Choose three interests and Riverton. Continue to the Home feed.

**0:20–0:45 — Understand what you see**

“The feed uses interests I chose, my approximate city, joined communities, recent activity, and endorsements. I can see the recipe, and it never guesses my political affiliation.”

Open How your feed works, then the spotlight petition. Show the requested action and recipient. Briefly open Updates and Responses.

“An official-looking response only receives verified styling when its verification state permits it. This seeded example is explicitly fictional.”

**0:45–1:05 — Add a voice without giving up privacy**

Tap Add my signature. Keep Anonymous selected. Confirm.

“This petition requires privately approved email eligibility, but my public signature says Anonymous supporter. Those are separate rules. A second signature is prevented in the data layer and database.”

**1:05–1:50 — Turn an idea into a petition**

Open Create. Choose the safer-walk template. Enter an original observed problem and a specific action. Apply a simulated title suggestion. In Details, enter a recipient and apply the supplied-text summary suggestion. Keep Riverton, a goal, and a future deadline. Choose email eligibility and anonymous public identity. Preview and publish.

“The helper is deliberately simulated. It rearranges my own words, shows a completeness rubric, and never invents a statistic, official, source, or endorsement. I can edit or undo every suggestion. Nothing is auto-published.”

**1:50–2:20 — Show follow-through**

Open Manage. Post: “We are collecting feedback on the requested lighting assessment.” Show the update. Return to Profile, switch to Sam, open the new petition, and sign anonymously.

“Creators can post progress and make explained edits. They cannot rewrite signatures or silently change eligibility after people have signed.”

**2:20–2:45 — Connect the community**

Open Communities, join Riverton students, and post a short idea.

“Petitions are connected to people who can work together. Swipe4Change includes discussions, endorsements, milestones, badges, and reports. Its value is a clear, accountable next step—not just a bigger number.”

## Backup demonstration

If time is short, use the flagship petition’s existing updates, edit history, endorsement, milestone, discussion, and response. If a network or credential is unavailable, the local demo works without either. To demonstrate resilience, Profile → Simulate next write failure and attempt a save. The temporary state rolls back and the user sees a clear retry message.

## Responsible design

No inferred politics, donation flows, fake generated evidence, or claims of real verification. Approximate city matching is optional, and exact addresses are never requested. The competition prototype does not claim to solve bot detection, real residency verification, or staffed moderation. Its privacy boundary and backend limitations are documented honestly.

The discovery demo now includes a reversible swipe deck, topic filters, and explainable recommendations informed by signed petition topics. Show a draft saved before it is complete, then resume it from the personalized profile. Badges recognize confirmed participation. The private signature vault demonstrates owner-controlled encryption; it does not demonstrate voter-roll verification or legally qualified ballot collection. Show the four mandatory legal checks and a pending encrypted receipt/collector affidavit. Explain that real legal acceptance requires the responsible authority’s review; no fictional record is presented as legally valid.
