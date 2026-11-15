# Direct demo contributions

The hackathon demo applies reader-supplied books, questions and answers immediately, without an
admin review. Use **Catalog → Add a book & questions**, or the same form after a failed game.
Readers can submit a title alone, add up to 20 yes/no questions with five-choice answers, and
optionally include all answers from the failed game (selected by default). Selecting an existing
title applies the supplied answers to that book instead of creating a duplicate.

The original failure was an early return when the optional sharing checkbox was unchecked:
the app displayed “Your answers were not sent” without recording the chosen book. New books
went into the moderation queue and were never loaded into the playable release. The replacement
does not depend on that checkbox, a completed game, or a review.

## Enable shared additions in Supabase

Project: https://supabase.com/dashboard/project/jvfxqusmnfdvslrgbjyv

Apply `supabase/migrations/20261115040000_demo_direct_contributions.sql` once using the project's
SQL editor or authenticated Supabase migration tooling. It adds:

- `submit_demo_contribution(p)`: signed-in (including anonymous) readers can publish a validated
  demo entry immediately. Existing contributor blocks and submission quotas still apply.
- `get_demo_contributions(release_version)`: any visitor can load the public demo entries. No
  contributor account IDs are returned.
- A release-derived limit for `submit_game_session`, so full-bank games exceeding 40 answers
  can also be saved through the existing session API.

Use the existing `VITE_SUPABASE_URL` and public `VITE_SUPABASE_ANON_KEY`; anonymous sign-in must be
enabled. The GitHub Pages workflow already supplies these public values. No service-role key
belongs in the browser. The dashboard URL alone does not authorize running migrations.

After applying the migration and deploying the frontend, add a test book and a question. Open the
same collection in another browser: the book and question should be available without a review.
The success message explicitly distinguishes shared publication from device-local storage.

If Supabase is unavailable or the migration is missing, additions remain playable immediately
in this browser and persist in localStorage. They are not silently published later. If neither
browser storage nor shared publishing succeeds, the form shows an error rather than claiming
the book was saved. Clearing browser storage removes local-only additions.

## Runtime data

`src/community/demo.ts` builds a separate overlay over the immutable catalog release. Unknown
metadata and answers stay unknown. Answers map to the existing 0.1/0.3/0.5/0.7/0.9 probabilities;
reader entries are labelled `demo_contribution`, with no fabricated source or review. Questions
written for one book do not invent labels for other books. This allows the engine to use new
questions while treating the other books' answers as unknown. The engine's normal thresholds,
neutral “Not sure”, Undo and rejection behavior remain intact.

The app's maximum is now the number of active questions on its current shelf, including demo
questions: originally 115 on research and 63 on classic. Inactive questions remain excluded.
The engine can finish sooner when confident or when its eligible questions have insufficient
information. Historical 40-question simulation reports have not been rerun or relabelled.

Checks: `npm run verify`; pure overlay/guess/full-bank regressions in
`tests/demo_contributions.test.ts`; shared publication and >40-answer database regressions in
`tests/db/schema.test.ts`.
