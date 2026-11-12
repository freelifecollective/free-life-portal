# Things to come back to

## Plans (the sales page, `src/lib/plans.ts`)
- The three plans are **$47, $97 and $297 a month** (Starter, Builder, Leader). Each card's "Choose this plan" opens that plan's sales page in place of the cards (`?plan=47|97|297`, so it can be linked to); "Take me back to the other plans" brings the cards back. All the words live in `src/lib/plans.ts`.
- Checkout is not connected: the "Join" button on a sales page only remembers that someone wants the plan (table `plan_interest`). The payment processor is **Payarc**; connecting it is the next step.
- Plan counts and the "just purchased" bubble use real data. An admin sets a member's plan on Members and Leads → Current members.
- **Seven plans**: $33 founders (Starter), and $47 / $97 / $297, each for Lacey's Downline or for people outside it. `profiles.plan` is the tier; `profiles.founder`, `founder_lost_at` and `lacey_downline` say which version. Admins set them by hand (Plan column) until Payarc does it.
- Founders rules (for the Payarc work): $33 for life while payments continue; two missed payments in a row moves the next payment to $47 for good (set `founder_lost_at`); upgrading then downgrading keeps $33; cancelling and rejoining starts at $47.
- **Plan access**: Builder ($97) and Leader ($297) pages use `requirePlan(97)` / `requirePlan(297)` (sends others to that plan's sales page); database rules use `plan_at_least(97)`. Existing pages are not limited by plan yet: decide what members without a plan keep before launch.
- Still to decide: what differs between the Lacey's Downline and outside version of each plan; whether $297 gets any Free Life AI allowance.
- Wallet (Builder and Leader only): texts, emails and AI beyond the allowance. Top-ups charge the card on file. $97: the platform pays the card fee. $297: the card fee comes out of the top-up and they get no AI allowance from the platform (to confirm).

## Funnels (Builder and Leader)
- Advertising → Funnels replaces Landing Page for Builder/Leader (admins see both). Bubbles at the top: Funnels, Forms, Automations, Emails.
- A page is sections → rows (1–4 columns) → elements (headline, sub-headline, paragraph, image, video, button, form, bullet list, divider, spacer), kept as JSON per step (`src/lib/funnels/types.ts`). Every save goes through `sanitizePage` (known keys only, colours/links/sizes checked, no HTML).
- Editor: `/advertising/funnels/<id>`. Click to choose, drag elements between columns, settings on the right (content and look: padding, margin, fonts, sizes, colours, corners, border, shadow, background picture), computer/phone preview, undo/redo, saves itself a moment after each change.
- Live pages: `/f/<username>/<funnel>/<step>` (first step when none is named). They go offline if the owner moves below Builder. Form sign-ups land in `funnel_submissions` and show under Forms.
- Later: inline text editing on the canvas, more elements (countdown, testimonials), a spam limit on form sign-ups.
- Emails and texts (Funnels → Emails): members start from ready-made ones (`src/lib/messages/defaults.ts`) or write their own. `{first_name}`, `{last_name}`, `{email}` are filled in when sent.
- Automations (Funnels → Automations): when a form on a funnel (or any funnel) is filled in, the database lines up each step: emails into `email_outbox` (template `member_message`, sent by the existing drain once the email service is on), texts into `sms_outbox` (no sender yet: connect Telnyx). Wallet charges for each email/text are not in yet.
- The existing email sender uses Resend. Amazon SES is about ten times cheaper per email if member automations get busy; switching is a small change in `src/lib/email/send.ts`.

## My Courses (Builder and Leader)
- Courses → My Courses: members build their own courses (details, cover, price and currency, lessons with Vimeo/YouTube video and notes, free-preview lessons) to sell outside of Enagic. Separate from the FLC courses (`member_courses`, `member_lessons`).
- Public course page: `/c/<username>/<course>` (published only, owner on Builder/Leader). Paid lessons show only their titles.
- Still to build: connecting the member's own Stripe or PayPal (Stripe Connect / PayPal partner onboarding), checkout, and enrolled students watching the lessons.

## White-label plan ($297), parked
- Each $297 customer gets a completely separate portal (own leads and members, members named something other than "FLC Members", their own name instead of "Lacey's Downline", which is optional).
- First login after paying walks them through: platform name, logo, brand colours and everything else needed to white-label it; a few things stay fixed (some things they cannot change or download).
- Admin (Sonya) needs a dropdown to switch into any customer's portal with full access for tech support, like GHL sub-accounts.
- Own domain (most will) or a subdomain.
- A personal login is created for them and **all** their data (chats, Your Organization, landing page, everything customised) migrates from their old $33/$47/$97 account, which is then closed. Downgrading migrates it all back to the matching plan. If they have paying team members ($47/$97) inside their portal when they downgrade, those accounts move to the main Free Life Collective portal.
- Open questions: final plan price list, consent wording for moved team members, what happens to their leads and custom chats on a downgrade.

## Other parked items
- Payment provider choice, email service and domain setup, Google credentials (calendar), native-speaker check of the translations.
- Landing page: the video address, the background photo, and the footer link addresses (Terms of Use, Privacy Policy, Earnings Disclaimer).
- Landing page choices (Landing Page tab): Builder/Leader change the words (`COPY_FIELDS` in `components/landing/content.ts`), their video (Vimeo or YouTube link) and the picture on the video. $33/$47 get a switch between the standard video and their coach's video, shown only when the coach is on Builder/Leader and has their own video. If someone moves down from Builder, their own words, video and picture stop showing (they are kept). A completely different design comes with Funnels.
- Create a Quote: prices for every country other than the United States.
- Know Your Numbers: decide what else to show.

- Locked-page previews: set PREVIEW_MEMBER_EMAIL and PREVIEW_MEMBER_PASSWORD (Vercel) to a normal member account kept EMPTY (no tasks, leads, chats). Downline see the real pages through it, washed out. Without them the pages show only what the downline person can already see.
