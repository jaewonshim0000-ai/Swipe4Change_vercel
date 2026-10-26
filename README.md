# Swipe4Change

A mobile-first petition app for iOS, Android and the web. Swipe through local petitions picked for
your interests and city, sign with the name you choose to show, start your own petition, and follow
it until it reaches someone who can act on it.

## Features

- **Swipe deck:** right to sign, left to pass, up to read. The ranking is explainable: interests,
  city, communities, freshness and what you sign, save and read. Each card says why it is there.
- **Signing:** read the exact text, choose a full name, first name and last initial, or anonymous,
  and draw your signature. One signature per person, enforced by the database.
- **Organizer rules:** any account, verified email, community members, or a custom rule. Organizers
  never see a signer's email or address.
- **Create:** templates, a writing check with a 0–100 score, an AI writer that drafts from your own
  description, real elected officials, and an AI recipient finder that cites its sources.
- **Follow-through:** updates, public edit history, milestones, a delivery packet for the recipient,
  recorded responses and a printable QR poster.
- **Ripple:** see how many people signed through your share link, without anyone being named.
- **Communities:** discussion, announcements, events, moderation, and member votes to back a
  petition.
- **Explore:** search, filters, and real federal rules open for public comment.

## Tech stack

Expo SDK 57 and React Native with strict TypeScript, Expo Router, TanStack Query, React Hook Form
and Zod, Clerk for sign-in, Supabase (PostgreSQL with row-level security, Storage and Edge
Functions), and Claude on the server for the AI features. Jest and React Native Testing Library for
tests.

## Run it

Use Node 22 or newer.

```sh
npm ci
cp .env.example .env
```

**Offline demo (no accounts needed):** set `EXPO_PUBLIC_BACKEND=demo` in `.env`, then run
`npm run web`. Pick a demo account (Anish, Maya, Sam or Jordan). All demo people, petitions,
signatures and responses are fictional.

**Phones:** `npm start` starts Metro; `npm run ios` / `npm run android` open a simulator or
emulator. `eas.json` has preview, development and production build profiles.

## Live setup

1. **Clerk:** create an application with Email and Google sign-in. Under Sessions → Customize
   session token, use:
   ```json
   {
     "role": "authenticated",
     "email_verified": "{{user.email_verified}}",
     "name": "{{user.full_name}}"
   }
   ```
2. **Supabase:** create a project and add Clerk under Authentication → Third-Party Auth.
3. **`.env`:** set `EXPO_PUBLIC_BACKEND=supabase`, `EXPO_PUBLIC_SUPABASE_URL`,
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
4. **Database and functions:**
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npm run supabase:push
   npx supabase functions deploy ai-review --no-verify-jwt
   npx supabase functions deploy civic-lookup --no-verify-jwt
   npx supabase secrets set ANTHROPIC_API_KEY=... OPENSTATES_API_KEY=...
   ```
   Deploy `ai-review` before anyone publishes: new petitions stay hidden until it checks them.
5. **Web:** import the repository into Vercel and add the three `EXPO_PUBLIC_` variables.
   `vercel.json` handles the build. `npm run preview:web` serves the same build locally.

Never put `ANTHROPIC_API_KEY`, `OPENSTATES_API_KEY` or any secret key in an `EXPO_PUBLIC_`
variable, and never push `supabase/seed.sql` (fictional data) to a live project.

## Scripts

| Command                | What it does                                        |
| ---------------------- | --------------------------------------------------- |
| `npm run web`          | Start the app in a browser                          |
| `npm start`            | Start Metro for iOS and Android                     |
| `npm test`             | Unit and UI tests                                   |
| `npm run test:db`      | Run every migration and the seed in a test database |
| `npm run typecheck`    | TypeScript check                                    |
| `npm run lint`         | ESLint                                              |
| `npm run export:web`   | Build the web app                                   |
| `npm run preview:demo` | Build and serve the web app with the offline demo   |
| `npm run seed`         | Regenerate `supabase/seed.sql` from the demo data   |

## Project structure

```text
app/                  Screens and routes (Expo Router)
src/components/       UI components and the theme
src/domain/           Ranking, rules, validation and the data model
src/data/             Offline demo and Supabase data layers
supabase/migrations/  Tables, row-level security and database functions
supabase/functions/   Server functions for the AI features and officials lookup
tests/                Jest tests
scripts/              Seed, database test and preview tools
```

## AI use

Claude runs only on the server, for the petition writer, the recipient finder, the spam check on
new petitions, report review, and hidden topic tags that improve recommendations. The writing
score, flags and suggestions are fixed rules, not AI. Much of the code was written with Claude Code.

## Limitations

- Sign-in runs on a Clerk development instance (up to 100 accounts) until the app has its own
  domain.
- Notifications are in-app only. There is no push or email yet.
- There is no real residency check, so the location signing rule is offered only in the demo.
- Official responses can be marked verified only by a trusted administrator.

## License

MIT. See [LICENSE](LICENSE).
