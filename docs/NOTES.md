# Things to come back to

## Plans (the sales page, `src/lib/plans.ts`)
- The three plans are **$47, $97 and $297 a month**. The names (Starter, Builder, Leader) and the little feature lists under each are **placeholders**: write the real features, and link each "Choose this plan" button to its sales page / checkout.
- Checkout is not connected: the button only remembers that someone wants the plan (table `plan_interest`). A payment provider still has to be chosen.
- Plan counts and the "just purchased" bubble use real data. An admin sets a member's plan on Members and Leads → Current members.

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
- Create a Quote: prices for every country other than the United States.
- Know Your Numbers: decide what else to show.
