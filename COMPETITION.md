# Swipe4Change — Congressional App Challenge

**Problem:** People notice local problems but often cannot find a clear request, the responsible recipient, or a trustworthy way to participate. Petition counts alone do not tell the whole story, and a supporter never sees what their sharing achieved.

**Audience:** Students, neighbors, community organizers, and people who want to contribute without making their identity public.

**Civic value:** Swipe4Change connects a concrete concern to an action, a responsible recipient, supporting sources, a community, and visible follow-through — ending in a delivery packet that actually reaches the office and a response recorded against it. It supports constructive local participation without campaigning, fundraising, payments, or political profiling.

**Innovation:** **Ripple** shows each supporter the change they started: after you sign, your share link carries an opaque code, and everyone who signs through it — and everyone who signs through _their_ links — becomes your ripple, drawn as rings around you. It rewards spreading with counts, never names: nobody learns who signed through their link, only signers earn credit, and a bad link never blocks a signature. Private signature eligibility and public identity are two separate choices, so an email-verified signer can remain publicly anonymous. Signing is a drawn signature attached to the exact text the person read. The feed explains its ranking, and a deterministic writing helper improves clarity without manufacturing evidence.

**Technical explanation:** One Expo/React Native TypeScript app runs on iOS, Android, and web. Expo Router organizes the five tabs and deep links. React Hook Form and Zod validate drafts. TanStack Query handles data, pending state, invalidation, and rollback. The persistent local adapter and Clerk-authenticated Supabase adapter share a typed command boundary. PostgreSQL uses RLS on all exposed public tables, a unique signature constraint, transactional row locks, and narrowly authorized functions; a recursive query computes each ripple and returns only counts. Pure domain tests and PostgreSQL integration tests exercise privacy, permissions and ripple attribution in both backends.

## A 2–3 minute demonstration

Target: **2 minutes 50 seconds**. Start in the local demo as Maya with onboarding completed. Keep a short original request ready to enter. All names, evidence, signatures, deliveries, and official responses are fictional.

**0:00–0:25 — A familiar local problem.** Show Home's Riverton welcome and the swipe deck, led by the Eastbridge lighting petition. Swipe up (or tap **Read**) to open it. Explain the dark campus-to-bus path, the requested lighting plan, the responsible Public Works recipient, and the sample audit.

**0:25–1:00 — Deliberate participation.** Tap **Review and sign**. Read the exact text and the eligibility check, choose **Anonymous supporter** from the exact name previews, then draw a signature and tick the consent box. The confirmation appears only after the write succeeds. Point out that only Maya can open her drawing, and that the database rejects a duplicate. Tap **Share my link**.

**1:00–1:35 — Ripple.** Switch to Sam and open the copied link: “Shared with you by someone who signed it.” Sign as Sam. Switch back to Maya and open the bell: **Your ripple grew** — someone signed, never who. Show the rings on the petition page and on Profile, and the line “1 signed because a supporter shared it.” Say: “Only people who signed can earn a ripple, and nobody is ever named.”

**1:35–2:15 — Turn a concern into a clear request.** Open Create. In **Write it for me ✦**, describe the problem in plain words and let the AI draft the petition (with an API key; otherwise type the fields). Point out that it asks questions instead of inventing facts, and that every field stays editable. Pick the city and an elected official or use **Find the right recipient ✦**. Show the writing check and readability score. Publish through the final confirmation: the spam filter checks it, and it can be signed straight away. Say: “Anyone can start a petition, whatever their writing skills, and spam never reaches the feed.”

**2:15–2:35 — Follow-through.** Back on Eastbridge, open **Progress**: the delivery packet sent at 500 signatures and the verified fictional response recorded against it. In **Activity**, show the organizer update, student question, endorsement and public edit history.

**2:35–2:50 — Personal impact and control.** On Profile, show the ripple, badges, and saved/signed petitions. Name the five technical ideas: explainable ranking, private eligibility checks, user-controlled public identity, database duplicate prevention, and count-only ripple attribution.

## Backup demonstration

If time is short, use the flagship petition’s existing updates, edit history, endorsement, milestone, discussion, delivery and response, and show the ripple rules in `tests/ripple.test.ts`. If a network or credential is unavailable, the local demo works without either. To demonstrate resilience, Profile → Simulate next write failure and attempt a save. The temporary state rolls back and the user sees a clear retry message.

## Responsible design

No inferred politics, in-app payments, fake generated evidence, or claims of real verification. Approximate city matching is optional, and exact addresses are never requested. A drawn signature is visible only to the person who drew it and is not a legally certified signature. Ripple shows counts only, and a sharer is never told who signed through their link. The competition prototype does not claim to solve bot detection, real residency verification, or staffed moderation. Its privacy boundary and backend limitations are documented honestly.
