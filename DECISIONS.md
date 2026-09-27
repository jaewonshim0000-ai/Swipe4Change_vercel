# Engineering decisions

1. **A typed local adapter is the credential-free default.** It provides the full demo, persists per device, and serializes transactions. It contains only fictional accounts. Supabase implements the same command contract so UI behavior does not depend on the backend.
2. **Eligibility and visibility are independent.** A signature stores an allowed public display name, while the private account relationship stays behind authorization. Neither the organizer nor the public receives email, phone, address, Clerk subject, or verification evidence. The public display name is captured at signing time so subsequent profile changes cannot silently rewrite historical signatures.
3. **Rules lock after the first signature.** The specification permits warned material edits. We choose a stricter invariant for signing requirements, allowed identities, community eligibility, and custom rules: create a new petition to change them after signatures exist. Title/action changes preserve previous content and a public explanation. The database enforces the lock even for direct administrative updates.
4. **Supabase uses narrow command RPCs plus RLS.** No direct client INSERT/UPDATE/DELETE grants. Every write obtains the actor from the validated Clerk JWT mapping and checks resource authorization. Signature writes and edits acquire the same row lock, and the unique signature constraint is the final duplicate barrier. Public snapshots are constructed from explicit fields; authentication mappings and approvals live in an unexposed private schema.
5. **No false verification.** The local UI labels all seed claims as fictional. New organizer responses are unverified. Trusted admins are the only path to real verification, eligibility approvals outside custom organizer review, moderation decisions, and badge awards. A user-selected city is a ranking signal, never proof of residence.
6. **Deterministic, inspectable personalization and AI.** A pure rule module produces rank explanations, diversity, suggestions, and a visible completeness rubric. No external model, sensitive trait inference, fact-checking claim, or invented evidence. Suggestions are applied only on request and can be undone.
7. **StyleSheet over a second styling runtime.** Shared tokens and reusable native controls serve iOS, Android, and web. Cards wrap at tablet widths. Topic illustrations are code-native abstract art, avoiding remote image dependencies and missing-image failures. Controls scale with text and require no motion.
8. **Small snapshot queries, explicit optimistic status.** Whole snapshots keep the competition app easy to inspect. Save/sign operations retain a rollback snapshot. The UI says confirmation is pending until the transaction succeeds. Production pagination and realtime invalidation can replace snapshot transport without changing domain commands.
9. **Fictional evidence is an honest placeholder.** Example.org source links are labeled illustrative; the seed does not pretend that a real audit, official, institution, or endorsement exists. Arbitrary user source links are never automatically marked verified.
10. **No automatic notification permission request.** In-app signature confirmations work now. Push delivery, digests, maps, uploads, production collaboration invitations, and real verification operations remain explicit future scope rather than inert controls.

11. **Swipe4Change rebrand preserves technical identity.** The display name, package metadata, UI, sharing copy, and new links use Swipe4Change. The original native application IDs, storage keys, and SQL/RPC names remain stable so existing installs, drafts, and deployed databases continue working. The original URL scheme remains a registered alias. The Supabase adapter translates the legacy system notification author for display.

12. **Transparent history signal.** At most ten of the 35 interest points come from topic frequencies among petitions actually signed. No affiliation is inferred. Opt-out restores all 35 points to explicit interests. Already-signed and expired petitions do not occupy the swipe deck.
13. **Separate incomplete drafts.** `petition_drafts` stores bounded private drafts without relaxing published-petition validation. Draft ownership is checked in both adapters; public snapshots cannot reveal another person's draft. Publication removes the draft within the same transaction.
14. **Recipient and legal writing support stay honest.** Local deterministic rules suggest the responsible department and supply official research starting points. Creators can override assignments. The tool does not invent officials, evidence, findings, or claims of legal validity.
15. **Signature vault is owner-encrypted.** A random AES-256 key stays with the user; account and format are bound as GCM authenticated data. Only ciphertext is persisted. SecureStore remains limited to auth tokens. The vault is outside feed snapshots and unlocked forms clear on blur/background/time limit. A residence statement remains self-attested until a trusted external check exists. _(Superseded by 43.)_
16. **Legal qualification is a separate workflow.** Ballot requirements vary by jurisdiction and measure type. The four requested requirements must have explicit records and review states; an encrypted drawing alone is not a qualified signature. Per-petition binding, affidavits, full-text receipts, exact statutory thresholds, and trusted review remain active work. _(Superseded by 43.)_

## Exact consent and qualification records (September 10) — superseded by 43

Each new signature requires an owner-encrypted receipt and fresh consent to the entire official text and configured legal requirements. The disclosure is compared server-side under a row lock; ciphertext uses the same ordered disclosure as AES-GCM authenticated data. Old receipt formats remain readable, but old support lacking a receipt never becomes a qualified signature. Legal setup locks once any receipt exists; audit records preserve prior configurations. Signature/profile changes cannot rewrite consent.

Every petition has four mandatory qualification checks. Missing setup blocks new signatures; submissions remain pending until trusted external review. Community goals and fictional sample counts never substitute for statutory thresholds. The responsible authority supplies the exact count and rounding rule; the app does not infer them from topic or location.

Circulator affidavits bind the collector's encrypted signature and private document references to an exact declaration and list of receipt IDs. They require a witnessing attestation and a notarial reference when configured, without claiming those assertions are verified. Only database-owner review functions can accept requirements, affidavits and signatures. Acceptance requires reviewed official text, a registration match, valid signature and accepted covering affidavit; notarization is required when the configured rule says so. Reviews append audit rows; dependent acceptance must be revoked first when invalidating prerequisites.

The default local demo cannot award legal acceptance. Real verification and document exchange must use the authority's approved process. This prototype does not validate voter rolls, operate as a notary, or guarantee jurisdictional recognition of a reused digital signature. Encryption is owner-controlled, so reviewers do not receive automatic access to private signatory data.

## Closing the feedback loop (September 12)

17. **Every event that changes a petition notifies the people it concerns.** Notifications previously had one writer — your own signature receipt — so a signer never learned that the petition they signed was updated, revised, answered or closed, and an organizer never learned that someone had signed, endorsed, posted, or was waiting on an eligibility decision. Both adapters now fan out from a single `notify` helper over two audiences: `followers` (signers and savers) and `managers` (owner and collaborators), each excluding the actor. Organizer-facing notices carry only the public identity the signer chose, never their account name, so an anonymous signature stays anonymous in the organizer's inbox. Delivery is still in-app only; push and digests remain out of scope.
18. **Saving a petition is following it.** Rather than adding a separate subscription concept, a save is treated as the follow primitive it already resembled. Someone can track a petition's progress without signing it, which matters when the signing rules exclude them.
19. **Signature velocity is a rolling window.** The local adapter incremented a lifetime counter that Trending read as "recent", so Trending would have converged on "most signed ever". Real signatures now carry a private timestamp and velocity is recomputed over the trailing seven days, matching what the SQL snapshot already did. The timestamp is stripped from the public signature projection: an exact signing time would let anyone correlate an "anonymous" supporter with whoever was visibly active at that moment.
20. **A published petition is revisable field by field; its audience is not.** Decision 3 locked signing rules after the first signature, but the `edit` command only ever carried title and action, so a typo in the problem statement, a missing source, or a deadline that needed extending were permanent. Edits now take a validated patch over every content field. `topic` and `communityId` stay immutable because they define the audience a petition was signed into, and the rule fields still lock once a signature exists. The merged result is validated against the same schema the creation form uses, so a patch cannot leave a petition in a state creation would have rejected, and the prior wording of every changed field is written to public history.
21. **A signature can be withdrawn; a post is retracted, not erased.** Consent that cannot be revoked is not consent, so withdrawing removes the public row, decrements the count (never below the fictional seed baseline) and deletes the private signatory record — unless it is already covered by a submitted circulator affidavit, which the organizer must handle. Post removal takes the opposite approach: a discussion post, community post, organizer update or recorded response is replaced by a visible note saying it was removed and by whom. A thread that silently loses posts misrepresents the conversation, and signers were already notified about updates and responses.
22. **Communities are member-created and member-moderated.** The four seeded communities were a fixed constant with no way to add one and no role above owner. Anyone can now create a community — becoming its owner and first member, with a headcount that carries no fictional padding — and an owner can appoint moderators from actual members. Moderators can only retract posts; they cannot touch petitions, signatures or memberships. Member removal and banning are deliberately absent: they need an appeals story this prototype cannot honestly staff.
23. **Archival is hidden from everyone, including the organizer.** `archived` was a declared status nothing could reach. An owner can now archive, but only after a public close or from a draft, so supporters learn the outcome before the petition disappears. Once archived it leaves every view — its organizer's included — and accepts no further commands, which is what the confirmation warns. That makes archival terminal for its signatures too: a supporter can no longer reach the petition to withdraw, so the honest order is to withdraw before an organizer archives. A production service would need a retention and erasure path here rather than a one-way hide. Reports gained a matching withdrawal: a reporter can retract their own report, while the `reviewed` state stays reserved for the trusted server-side review that decision 5 requires.

## Mobile design pass: discovery surfaces (September 13)

24. **The phone design is applied at phone widths, not everywhere.** The imported Claude Design file is a single 402-point frame, and the app ships to web as well as iOS and Android. Rather than collapse the desktop experience to a phone layout, every design-specific simplification is gated on a width breakpoint: Home drops search, section chips and the editorial hero below 760 points and keeps them above it; Explore lists rows below 760 and the existing grid above. One design, two honest layouts, and no desktop affordance deleted to match a frame that never described desktop.
25. **Explore browses by intent; Home ranks for you.** The two screens shared one set of sort chips, which made Explore a second copy of Home. Explore now has its own sections — Trending, Near you, Recently updated, Ending soon, Saved — each with a one-line explanation of what it actually sorts by, and it no longer carries the duplicate "Near me" topic chip. Home keeps For you, Trending and Saved. "Ending soon" and "Recently updated" are plain deterministic sorts over the deadline and the newest organizer update or edit, consistent with the non-goal of an opaque ranking algorithm.
26. **Seed deadlines are spread instead of shared.** Every seeded petition carried the same hardcoded deadline, so all twelve cards read an identical countdown and "Ending soon" had nothing to order. Deadlines are now derived deterministically from the petition index, 18 to 300 days ahead of the moment the seed runs, which also removes the standing chore of moving one hardcoded date forward before a demonstration.
27. **The ranking recipe is a table, not a paragraph.** The feed explanation was a single dense block of prose behind a "Why these?" toggle — technically transparent, practically unread. It is now a five-row table with the weight set in the display serif beside the factor and a plain-language note on what feeds it. Transparency that is not legible is not transparency.

## Swipe to act, and communities that can organize (September 13)

28. **A swipe is intent, never a signature.** The deck now reads three directions — right supports,
    left passes, up opens the full page — but supporting opens the signing sheet rather than recording
    anything. Nothing in this app should be able to add your name to a public document by accident, and
    a gesture is exactly the kind of input that happens by accident. The four circular actions and the
    Follow / Volunteer / Share row give every gesture a labelled equivalent, so the deck is fully usable
    without dragging at all.
29. **Saving and following are different asks, superseding decision 18.** Treating a save as a _(Superseded by 44.)_
    subscription was tidy, but it meant a person could not keep a petition to read later without also
    opting into its notifications. Saving is now a private bookmark that notifies nobody; following is
    the subscription. Signing and volunteering both subscribe you automatically, because neither is a
    passive act — nobody signs something and then wants silence. Existing saves were not migrated into
    follows: silently subscribing people to notifications they never asked for is the failure mode this
    decision exists to avoid.
30. **Volunteering is a named offer with no contact channel.** Unlike a signature, an offer of help
    cannot be anonymous — the organizer has to know who is turning up — so the UI says plainly that
    organizers see your profile name and chosen roles before you offer. What they never see is an email
    address, phone number or anything else; the app deliberately has no volunteer messaging channel, and
    the manager dashboard says so and points at organizer updates and community posts instead. A
    volunteer can revise their roles or step back at any time without asking permission.
31. **Donations are still out of scope.** A donate action was requested alongside the other swipe
    actions and was deliberately not built. Payment, donation and political fundraising are explicit
    non-goals for this project, and adding a money path would drag in compliance obligations a student
    demo cannot honestly meet.
32. **One post record behind nine community surfaces.** Discussion channels, announcements, a _(Narrowed by 45.)_
    calendar, a task board, polls, proposals, shared documents and a private organizer room are all the
    same row, distinguished by a space, a kind and a channel. Nine tables would have meant nine sets of
    row-level security policies to get right; this way the same rules cover every surface, and a channel
    is a filter rather than something an admin has to create.
33. **A community is three zones of authority, not one chat log.** Members post to public
    discussion; only the owner and moderators can post announcements, because an announcement carries the
    community's voice rather than one member's; and the organizer space is genuinely private — members
    cannot read it, not merely cannot post to it. Promotion to moderator is what opens that door.
34. **Counts are public; choices are not.** Poll votes and proposal positions are tallied in the _(Polls and proposals removed by 45.)_
    open and attributed to nobody. The ledgers live in their own tables with row-level security limiting
    each person to their own row, and the reader's own choice is the only one their snapshot carries.
    Consensus tools that publish who voted which way stop being consensus tools and start being
    pressure.
35. **A moderation report never names the reporter.** Moderators receive the reported post, its
    author and the reason, and nothing that identifies who reported it. Naming the reporter turns a
    moderation request into a confrontation between neighbours, and a moderator does not need it to judge
    the post. Resolving a report records the review; removing the post is still a separate, visible step
    that leaves the tombstone decision 21 established.
36. **Documents are links, not uploads.** Shared evidence uses the same labelled https:// pattern as _(Documents removed by 45.)_
    petition sources. File storage would need virus scanning, takedown handling and a retention policy
    before it could be responsibly offered, and none of those exist here. The UI says the links are
    member-supplied and unchecked.

## Closing the loop: delivery, recipients, plain language (September 16)

37. **Delivery is a first-class event, not a sentence in an update.** Until now a petition
    collected signatures and stopped; nothing in the data recorded that it ever reached the office it
    names, so "did this actually do anything?" had no answer. An organizer now records who it went to,
    how, and when, and an official response can point at the delivery it answers. This sits close to the
    "no full petition impact timeline" non-goal and is deliberately narrower than one: it records the
    hand-off and the reply, not a chain of claimed real-world outcomes the app cannot verify.
38. **A packet is a snapshot, not a live view.** The signature count and the list of public names
    are frozen into the delivery row at the moment it is recorded. Re-deriving them later would quietly
    rewrite history every time somebody new signed or withdrew, and a document sent to a public office
    has to say what was actually sent on the day it was sent.
39. **The packet can only contain what the petition already shows.** Names appear exactly as each
    signer chose to appear in public; anonymous signers are counted but never named; no email address,
    postal address, phone number or verification evidence appears anywhere in it. Printing opens a plain
    document window rather than printing the app, and the petition body is written with `textContent`
    rather than markup, because it is author-supplied text.
40. **The recipient directory teaches which office decides.** Sending a request to the wrong office
    is the most common way a real petition dies quietly, and almost nobody knows off-hand that a
    crosswalk is Public Works rather than the mayor. Each fictional office lists what it can decide and,
    given equal weight, what it cannot and who can instead. Suggestions rank by topic match then keyword
    match — explainable, deterministic, and never hidden from the reader. The recipient stays a free
    text field so an organizer can name an office the directory has never heard of.
41. **Response times come from the directory, never from the app's own guess.** The demo's
    `responseDays` are invented alongside the fictional offices. A real deployment would load its own
    jurisdiction's directory and take those numbers from published service standards; the app has no
    business estimating how long a real office takes.
42. **Readability is measured, not enforced.** A Flesch–Kincaid grade level plus passive-voice,
    vague-verb and unmeasurable-ask checks run on the author's own words. They report and never rewrite,
    and nothing they find blocks publishing. The heuristics are deliberately simple rather than clever:
    a syllable estimator and a be-verb scan will both be wrong on some sentences, and the cost of that
    is one ignorable suggestion, while the benefit is a check that runs offline with no model and can be
    read and argued with by the student maintaining it. Completeness scoring answers "are the fields
    filled in"; this answers "can a neighbour read the result", which is the harder question.

## 2026-09-19 — Refine around the Eastbridge journey

Keep Expo Router, the existing query/provider boundary, local persistence keys, Clerk/Supabase integration, encryption, and legal-qualification checks. Use incremental feature components instead of moving working modules. Home emphasizes local context; Explore owns intentional search and staged filters. Topic accents and rounded feature surfaces retain Newsreader and Work Sans.

Use three petition sections and progressive disclosure for advanced legal information. A right swipe expresses interest and opens review; it does not sign. The four-step signing sheet previews the actual `publicName` output, requires explicit consent, and displays a receipt only after the mutation resolves. Only this confirmed receipt animates signature progress. Persistent swipe guidance is a small per-account local UI preference, separate from server-owned participation.

Preserve hosted failure semantics: a failed remote write never falls back to a successful local write. The default local demo is the explicit offline presentation path. Updated seed content applies to fresh/reset demo state and repeatable development SQL, without rewriting saved user petitions. Existing draft step indices remain valid; users are asked to review regrouped fields before publishing.

## 2026-09-22 — Make sample cases and recipient guidance specific

Each seeded petition now has a distinct local problem and a fictional office in the relevant city with authority appropriate to the request. The assistant suggests only a recipient category; it does not insert a plausible but unconfirmed office into the publishable field. Organizers must choose or enter the actual recipient. This keeps deterministic writing help useful without making unsupported claims about jurisdiction. Signing eligibility presentation derives its state from the same rule that authorizes signing, while keeping location attestation distinct from approximate city personalization.

## 2026-09-22 — Compare the request with the answer, not a claimed outcome (removed by 46)

An organizer may split a requested action into one to three asks and compare each with a verified response linked to that petition. The status answers only whether the response text covers an ask. It does not assert that a promise was fulfilled or confer official verification. Every assessment includes an explanation, author, and date; revisions preserve the prior content in edit history. Changing the underlying requested action resets the comparison. The same typed command has local and server implementations; the server validates management rights and response verification before writing to the petition's public content. Existing local sample state receives only the new Eastbridge comparison where its original action and verified fictional response still match.

## 2026-09-23 — Trim to the core, and add Ripple

43. **Keep the drawn signature; drop the ballot machinery.** The vault (printed legal name, voter-registration
    address, recovery key, client-side encryption), the four-part legal qualification record, circulator
    affidavits and the trusted-review functions served a legal ballot-measure process the app does not
    and cannot perform. They also blocked every new petition from collecting signatures until an
    organizer filled in statutory details, and asked students for exactly the data AGENTS.md is most
    careful about. What people valued was the act of drawing a signature, so that stays: the signing
    sheet asks for a drawing and unchecked consent, the drawing is stored with the exact text read, and
    only the signer can open it. The server still refuses a signature if the text changed under the
    reader. Withdrawing deletes the drawing with the signature.
44. **Saving is following again, superseding decision 29.** Keeping them apart needed an 80-word notice
    to explain, a second button on every card and a second filter on the profile. One concept is
    easier to hold: a saved, signed or volunteered-for petition sends you its updates, and unsaving stops
    them. The `petition_follows` table and `follow` command are gone; the audience is derived from saves,
    signatures and volunteer offers.
45. **Communities keep discussion, announcements, events and the organizer room.** Polls, proposals,
    task boards and a document library were each a half-built version of a tool organizers already use,
    and together they turned a phone screen into a small Slack. Moderation reports stay: they are what
    makes an open discussion safe.
46. **The request-to-response comparison is removed.** It was a fourth layer on responses (record,
    verify, deliver, grade). A verified response beside the delivery packet already tells the story.
47. **One avatar.** The emoji avatar and accent colour duplicated the initials avatar the design system
    uses everywhere else, so the columns and command fields were removed.
48. **Migrations were edited in place rather than reversed forward.** Nothing has been deployed, and a
    forward "undo" migration would have left the removed features' SQL inside the decorator chain for
    every future reader. The chain labels are contiguous again (command v1–v6, snapshot v1–v4). **Anyone
    who applied the old migrations to a development database must reset it before applying these.**
49. **Ripple rewards spreading with counts, never names.** Petitions spread person to person, and nothing
    in the app showed a supporter what their sharing achieved. After signing, your share link carries an
    opaque code; people who sign through it — and people who sign through theirs — form your ripple.
    Rules, identical in both backends and tested in each:
    - Only someone who signed the petition earns credit.
      Self-links, stale links and made-up codes are ignored and never block the signature.
    - A signer can withdraw and re-sign through someone they brought in, so the chain can loop. Each person
      is counted once at their shallowest depth, and the SQL walk stops at depth 50.
    - Codes are random on the hosted backend and never a profile id. The local demo derives a stable hash
      instead, which is guessable and acceptable only because local data never leaves the device.
    - The referrer is told that someone signed, never who. An organizer who is also the referrer may still
      infer identity from a same-moment signature notification when the signer chose a public name; the
      signer picked that name knowing it is public, so this was accepted rather than delaying notifications.
    - The code is remembered on the device per petition, so arriving through a link and signing later still
      credits the sharer. On a shared device the next account to sign that petition inherits it; the demo
      accepts this because the alternative is dropping most real-world attributions.
