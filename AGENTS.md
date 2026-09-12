# Swipe4Change Engineering Instructions

## Mission

Build **Swipe4Change**, a polished, mobile-first petition discovery and organizing app for the 2026–2027 Congressional App Challenge. It must run on iOS, Android, and web from one Expo codebase. Users discover personalized and local petitions, inspect complete petition cards/pages, create petitions with a clearly labeled simulated AI helper, sign under manager-configured eligibility/privacy rules, participate in communities, and track updates, endorsements, milestones, badges, and official responses.

This repository should become a convincing, end-to-end competition demo—not a collection of disconnected mock screens.

## Working Style

- Work autonomously. Make reasonable product decisions when details are missing and document them in `README.md`.
- Inspect the existing repository before changing it. Preserve working code and user changes.
- Implement vertical slices that work through UI, validation, data layer, and tests.
- Keep the app runnable after every meaningful change.
- Do not stop at scaffolding, TODOs, or pseudocode when implementation is possible.
- Prefer simple, dependable solutions suitable for a student-maintained project.
- Use strict TypeScript. Avoid `any`, ignored errors, dead code, and unnecessary abstractions.
- Never commit secrets. Provide `.env.example` with safe placeholders.

## Required Stack

- Expo and React Native with TypeScript
- Expo Router for file-based navigation
- Supabase for PostgreSQL, storage, realtime features, and server-side functions
- TanStack Query for remote server state
- Zustand only for small client-only state
- React Hook Form and Zod for forms and validation
- Clerk for Auth
- NativeWind or a consistent React Native `StyleSheet` design system; do not mix approaches randomly
- `expo-secure-store` for authentication/session secrets only
- `react-native-maps` for the optional nearby map
- Expo Notifications for later notification support
- Jest and React Native Testing Library
- EAS Build configuration for preview builds

Use versions compatible with the current stable Expo SDK. Install Expo-managed packages with `npx expo install`.

## Product Priorities

### P0: Complete competition MVP

1. Authentication and onboarding
2. Topic interests and approximate location
3. Personalized petition feed
4. Complete petition cards and detail pages
5. Guided creation flow with simulated AI assistance
6. Signing with duplicate prevention
7. Manager-controlled verification and public identity options
8. Search, topic filters, saving, and sharing
9. Communities and membership
10. Creator dashboard, updates, and edit history

### P1: Competition polish

- Community discussions with structured post types
- Community or organization endorsements
- Milestones and user badges
- Reporting and appeals
- Recipient directory
- Official-response interface with explicit verification status
- Trending feed and location map
- Accessibility, responsive web layout, loading/error/empty states, and demo seed data

### P2: Stretch work

- Daily digest and push notifications
- Draft collaboration and suggested edits
- Advanced location eligibility verification
- Rich file evidence and realtime discussion updates

Finish P0 before investing in P1 or P2.

## Explicit Non-Goals

- No opaque engagement-maximizing algorithm.
- No advanced bot-detection system.
- No platform-authored fact-checking notes.
- No full petition impact timeline.
- No real generative-AI dependency in the initial version.
- No claim that an official, organization, residence, or signature is verified unless the underlying verification exists.
- No payment, donation, political fundraising, or candidate-campaign functionality.

## Navigation and Routes

Use five bottom tabs:

- **Home:** personalized feed, trending section, saved-state actions
- **Explore:** search, filters, communities, and optional map
- **Create:** multi-step petition builder
- **Communities:** joined communities and discovery
- **Profile:** petitions created/signed/saved, badges, and settings

Expected route families:

```text
app/
  _layout.tsx
  index.tsx
  onboarding/
  (auth)/
  (tabs)/
  petition/[id].tsx
  community/[id].tsx
  manager/[petitionId].tsx
  notifications.tsx
```

Use route groups and shared layouts appropriately. Deep links to petitions and communities must work.

## Core User Flows

### Onboarding

1. Register or sign in.
2. Choose at least three interests, with a skip option.
3. Select or enter an approximate city/state. Exact address is never required for feed personalization.
4. Land in a seeded, useful feed.

### Discover and sign

1. Browse personalized cards or search/filter results.
2. Open a petition and review requested action, recipient, evidence, eligibility, signature visibility, updates, edits, endorsements, and discussion.
3. Tap Sign.
4. Satisfy the configured verification requirement.
5. Choose from the public identity modes allowed by the manager.
6. Confirm the signature and update progress optimistically, with rollback on failure.

### Create and manage

1. Choose a template or start blank.
2. Enter the problem, requested action, responsible recipient, topic, community/location, goal, deadline, and evidence.
3. Use simulated AI suggestions and the petition quality checklist.
4. Configure signing eligibility and permitted public identity modes.
5. Preview the card and page before publishing.
6. Manage updates, collaborators, edits, milestones, discussion, and responses from the dashboard.

## Petition Card Requirements

Every card should show:

- Hero image or topic treatment
- Community and topic
- Title and one-sentence summary
- Approximate location
- Intended recipient
- Verified signature count and goal
- Progress bar
- Deadline or days remaining
- Signing requirement label
- Save, share, view, and sign actions

Cards must remain readable at small phone widths and accessible with large text. Do not overload them with full body copy.

## Manager-Controlled Signing Rules

Keep verification requirements separate from public visibility.

Supported verification modes:

- `account`: authenticated account only
- `email`: verified email required
- `community`: active membership in the selected community
- `location`: approved location attestation/verification flow
- `custom`: clearly written custom eligibility rule; initially manager-reviewed

Supported public identity modes:

- `full_name`
- `first_name_last_initial`
- `anonymous`

The manager selects which identity modes signers may choose. At least one mode is required. A signer can be privately verified while publicly anonymous. Never display email addresses, phone numbers, exact addresses, internal verification evidence, or authentication identifiers to petition managers or the public.

Enforce one signature per `(petition_id, user_id)` at the database level. A manager cannot sign on behalf of someone else, alter signatures, or change eligibility rules silently after signatures exist. Material changes must create an edit-history entry and present a warning.

## Simulated AI Assistant

The initial “AI helper” is deterministic and local. It should feel responsive while being honest in the UI and documentation that it is a prototype using structured rules/templates.

It may:

- Suggest specific titles from topic, action, location, and recipient fields
- Produce a concise summary from entered structured fields
- Flag missing recipient, action, location, deadline, evidence, or measurable outcome
- Calculate a 0–100 quality score with a visible rubric
- Suggest a relevant template or recipient category
- Offer one-click, reversible draft improvements

It must not invent evidence, statistics, public officials, endorsements, or legal claims. Suggestions remain editable and are never auto-published. Put the analyzer in a pure, tested module so a real model can replace it later without rewriting the UI.

## Personalization and Trending

Keep ranking explainable and deterministic. Begin with normalized factors:

```text
35% interest match
30% location match
20% joined-community match
10% recency/activity
 5% endorsements
```

Add modest diversity rules so a single topic or community does not dominate the first page. Trending should combine recent verified signature velocity, saves, discussion activity, and freshness with caps against tiny-sample spikes. Never infer political affiliation or use sensitive personal traits.

## Data Model

Create typed migrations for at least:

- `profiles`
- `topics`
- `user_interests`
- `communities`
- `community_members`
- `petitions`
- `petition_collaborators`
- `petition_sources`
- `petition_edits`
- `signatures`
- `petition_saves`
- `petition_updates`
- `petition_endorsements`
- `discussion_posts`
- `reports`
- `official_responses`
- `badges`
- `user_badges`
- `notifications`

Use UUID primary keys, timestamps, explicit status enums/check constraints, foreign keys, useful indexes, and soft archival where auditability matters. Generate or maintain matching TypeScript database types.

Petition status should support `draft`, `active`, `closed`, `successful`, and `archived`. Official responses need `unverified`, `pending`, and `verified` states. Only `verified` responses receive official visual treatment.

## Supabase Security

Enable Row Level Security on every exposed table. Default to deny, then add narrow policies.

- Public users can read active public petitions, communities, public updates, public edit history, aggregate signature counts, endorsements, and verified official responses.
- Users can update only their own profile and preferences.
- Authenticated eligible users can create only their own signature, save, membership, report, or discussion record.
- Petition owners and authorized collaborators can edit permitted petition resources.
- Community moderation requires an owner/moderator membership role.
- Official verification, appeals, and badge awards must use trusted server-side functions/admin operations.
- Public signature views expose only the selected display name mode, never private profile fields.

Never place service-role keys in the client. Validate authorization server-side even when controls are hidden in the UI.

## Design System

Aim for trustworthy, energetic, nonpartisan civic design—not campaign branding.

- Neutral base colors with one accessible civic accent and topic-specific secondary colors
- 8-point spacing system
- Rounded cards with restrained shadows
- Clear progress indicators and verification labels
- Minimum 44×44-point touch targets
- WCAG-aware contrast, semantic labels, screen-reader text, reduced-motion support, dynamic type, and keyboard navigation on web
- Skeleton states for feeds and details
- Friendly, specific empty and error states
- Confirmation before publishing, signing, reporting, or closing a petition

Centralize tokens for color, spacing, radius, typography, and shadows. Support light mode first; add dark mode only after the light experience is complete.

## State, Networking, and Errors

- Supabase remains the source of truth.
- Use TanStack Query keys and invalidation consistently.
- Use optimistic updates only for safe reversible actions such as save/sign; rollback and show a clear error if the server rejects them.
- Keep filters and draft state predictable across navigation.
- Handle offline/poor-network conditions gracefully; never imply a signature succeeded until the server confirms it.
- Log technical details in development, but show nontechnical, actionable messages to users.

## Seeded Demonstration

Include a repeatable seed command with realistic fictional data:

- At least 12 petitions across 5 topics
- At least 4 communities
- Different signing and identity configurations
- One petition with evidence, edits, updates, endorsement, badge milestone, discussion, and verified official response
- A flagship student-safety story involving improved lighting or a crosswalk near a school/campus

Clearly mark all demo officials, organizations, accounts, and signatures as fictional/sample data.

## Testing

At minimum, test:

- Feed scoring and diversity rules
- AI-helper scoring and suggestions
- Form schemas
- Signature eligibility and visibility combinations
- Duplicate-signature handling
- Permission-sensitive components
- Petition creation and signing happy paths
- Failure rollback for optimistic updates

Mock network dependencies deterministically. Add a small end-to-end smoke checklist to `README.md`. Run typecheck, lint, unit tests, and Expo export/build validation before considering work complete.

## Documentation

Maintain:

- `README.md`: setup, environment variables, scripts, architecture, demo accounts, demo walkthrough, and limitations
- `.env.example`: public Supabase URL/key placeholders only
- Supabase migrations and seed instructions
- `DECISIONS.md`: short records for important architectural or privacy decisions
- `COMPETITION.md`: problem, audience, innovation, technical explanation, civic value, responsible design, and a 2–3 minute demo script

## Definition of Done

The project is done only when a new developer can follow the README, start the app, authenticate, see a personalized seeded feed, create a petition with mock-AI assistance, publish it, sign under its configured rules, join a community, post an update/discussion entry, and view progress across mobile and web. There must be no critical console errors, obvious broken routes, exposed secrets, misleading verification labels, or inaccessible primary controls.

When tradeoffs arise, prioritize a reliable, demonstrable civic workflow, user privacy, and clear presentation over feature count.
