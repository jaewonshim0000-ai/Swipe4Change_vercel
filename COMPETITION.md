# Swipe4Change — Congressional App Challenge

**Problem:** People notice local problems but often cannot find a clear request, the responsible recipient, or a trustworthy way to participate. Petition counts alone do not tell the whole story.

**Audience:** Students, neighbors, community organizers, and people who want to contribute without making their identity public.

**Civic value:** Swipe4Change connects a concrete concern to an action, a responsible recipient, supporting sources, a community, and visible follow-through. It supports constructive local participation without campaigning, fundraising, payments, or political profiling.

**Innovation:** Private signature eligibility and public identity are two separate choices. An email-verified signer can remain publicly anonymous. The feed explains its ranking, and a deterministic simulated AI helper improves clarity without manufacturing evidence. The request-to-response comparison shows which concrete asks a verified response actually covers, with an attributed organizer explanation. It does not mistake a reply for a completed outcome. Public edits, updates, community endorsements, and explicitly labeled responses make follow-through inspectable.

**Technical explanation:** One Expo/React Native TypeScript app runs on iOS, Android, and web. Expo Router organizes the five tabs and deep links. React Hook Form and Zod validate drafts. TanStack Query handles data, pending state, invalidation, and rollback. The persistent local adapter and Clerk-authenticated Supabase adapter share a typed command boundary. PostgreSQL uses RLS on all exposed public tables, a unique signature constraint, transactional row locks, and narrowly authorized functions. Pure domain tests and PostgreSQL integration tests exercise privacy and permissions.

## A 2–3 minute demonstration

Target: **2 minutes 50 seconds**. Start in the local demo as Maya, with onboarding completed and the private signature vault prepared using fictional details. Keep the recovery key private and ready. Do not display or use a real address. Keep a short original request ready to enter. All names, evidence, signatures, deliveries, and official responses are fictional.

**0:00–0:30 — A familiar local problem.** Show Home's Riverton welcome and Eastbridge spotlight. Tap **Understand this petition**. Explain the dark campus-to-bus path, requested lighting plan, responsible Public Works recipient, and sample audit. Open **Why these petitions?** on Home if explaining ranking: explicit interests, location, joined communities, activity, and endorsements.

**0:30–1:10 — Deliberate participation.** Tap **Review and sign**. Show what is privately checked and what the organizer sees. Unlock the prepared vault in the eligibility step, choose **Anonymous supporter**, and review the privacy summary. Check the consent box and confirm. Show the receipt and updated progress only after the write completes. Explain that the database rejects duplicates and that a support record does not establish legal qualification.

**1:10–1:55 — Turn a concern into a clear request.** Open Create. Enter a specific problem, requested action, recipient, and city. Add a concise summary and deadline, choose participation rules, then compare card and detail previews. Show the completeness rubric and an editable, reversible suggestion. Say: “This prototype writing assistant uses local rules, not generative AI.” Publish through the final confirmation. Explain that a newly created petition still needs its legal requirements configured in Manage before signatures can be collected.

**1:55–2:30 — Participation after signing.** Return to Eastbridge. In **Activity**, show the organizer update, student question, endorsement, and edit history. In **Progress**, show the three-ask comparison: a promised review partly answers the first ask, while a published plan and deadline remain unanswered. Then show the sample hand-off at 500 signatures and linked fictional response. The comparison is Maya's reading of the response, never proof that lighting was installed. Show the follow control and joined Riverton students community.

**2:30–2:50 — Personal impact and control.** Open Profile to show created/signed/followed petitions and joined communities. Explain the five technical ideas: explainable ranking, private eligibility checks, user-controlled public identity, database duplicate prevention, and auditable edits.

## Backup demonstration

If time is short, use the flagship petition’s existing updates, edit history, endorsement, milestone, discussion, and response. If a network or credential is unavailable, the local demo works without either. To demonstrate resilience, Profile → Simulate next write failure and attempt a save. The temporary state rolls back and the user sees a clear retry message.

## Responsible design

No inferred politics, donation flows, fake generated evidence, or claims of real verification. Approximate city matching is optional, and exact addresses are never requested for discovery. The separate encrypted signature vault requests self-attested signatory details; use fictional details during the demo. The competition prototype does not claim to solve bot detection, real residency verification, or staffed moderation. Its privacy boundary and backend limitations are documented honestly.

The discovery demo now includes a reversible swipe deck, topic filters, and explainable recommendations informed by signed petition topics. Show a draft saved before it is complete, then resume it from the personalized profile. Badges recognize confirmed participation. The private signature vault demonstrates owner-controlled encryption; it does not demonstrate voter-roll verification or legally qualified ballot collection. Show the four mandatory legal checks and a pending encrypted receipt/collector affidavit. Explain that real legal acceptance requires the responsible authority’s review; no fictional record is presented as legally valid.
