# Free Life Collective portal


Next.js (App Router) on Vercel, Supabase for auth, database and file storage.
Built so far: phase 1 (foundation) and phase 2 (first-login flow and profiles). See `../BUILD_PLAN.md`.

## Run it locally (preview mode, no accounts needed)

```bash
npm install
npm run dev          # http://localhost:3000, open /welcome
```

With no Supabase variables set the app runs in **preview mode**: you can go through the whole first-login flow and
land in the portal; the profile is kept in a cookie and the picture in the browser. Preview mode is switched off in
production builds.

## Connect Supabase

1. Create a Supabase project. Copy the project URL and the anon (publishable) key into `.env.local` (see `.env.example`).
2. Apply the migrations in `supabase/migrations`, in order (`0001`, then `0002`). Either use the Supabase CLI (`supabase db push`) or paste each file into the SQL editor and run it.
3. Authentication > URL configuration: add your site URL and `<site>/auth/callback` as a redirect URL.
4. Make yourself the first admin (run once, in the SQL editor, after you have signed in once; use the email you sign in with):
   `update public.profiles set role = 'admin' where email = 'you@example.com';`
5. Roles are changed only by an admin (or in SQL); a member can never change their own role.

## Checks

```bash
npm run check        # types, lint, unit tests, database rules
npm run test:db      # applies the migrations to a throwaway local Postgres and runs the access-rule tests
npm run e2e:live     # runs the flow against your real Supabase project with throwaway anonymous visitors, then tries to break the access rules
                     # (turn on Authentication > Sign In / Providers > Allow anonymous sign-ins first, and off again afterwards; delete the test visitors in Authentication > Users)
npm run e2e          # drives the first-login flow in a browser (needs `npm run dev` running; BASE=http://localhost:3100)
```

## Layout

- `supabase/migrations`: roles, profiles, username rules, visibility helper (`can_see`), avatar storage, with row level security.
- `supabase/tests`: SQL tests for those rules.
- `src/proxy.ts`: refreshes the session and sends signed-out visitors to `/login` (Next.js 16 calls middleware "proxy").
- `src/lib/auth/session.ts`: the one place that reads the signed-in user (verified with the auth server).
- `src/components/first-login`: the first-login flow, ported from the approved prototype.
- `src/lib/avatar`, `src/lib/cutout`: picture generator and background removal.

## Notes

- Rank is never stored on profiles. It belongs to the Accountability Buddy answers (phase 7) and is private.
- Background removal uses the `@imgly/background-removal` model with the prototype's built-in approximation as a fallback.
  Self-host the model files in production and set `NEXT_PUBLIC_CUTOUT_MODEL_URL` (otherwise they load from the vendor's CDN).
- Sign-in currently lets any email request a link. Phase 3 (lead registration) restricts account creation.

- In a sandbox that sits behind an HTTP proxy, run Node with `NODE_USE_ENV_PROXY=1` so server-side calls to Supabase get through. A normal machine or Vercel does not need this.

## Sign-up is invite-only (from phase 3)

Only emails on `public.signup_allowlist` can create an account. Leads are added automatically when they register for a
call; an admin adds members and coaches under **People and invites**. Anyone else who asks for a sign-in link gets the
same neutral reply ("if that email is on our list...") and no account is created. Turn **Allow anonymous sign-ins** off in
production (it only exists to run `npm run e2e:live`).

## Calls, RSVPs and registration

- Admins add calls under **Manage calls** (times are Eastern). A call is either open to leads or for affiliates only.
- Members RSVP "live" or "recording" on the calendar; the tally uses counts, so 40 or 4,000 attendees work the same.
- Leads register without an account at `/register/<call id>`. The registration is stored, the email is added to the invite
  list, and a confirmation email is queued in `public.email_outbox`. **Sending the emails is not switched on yet** (it needs the
  email service and a domain). Optional sample calls: `supabase/seed/sample_calls.sql`.

## Deploying on Vercel's free plan

Vercel only starts a build for a commit made by the account owner. Changes pushed by anyone else (or by a tool) are
merged by the owner on GitHub (open a pull request and press Merge); the merge commit then starts the build.
