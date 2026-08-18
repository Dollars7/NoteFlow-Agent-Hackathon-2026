# NoteFlow — Retention-first learning

> **The system carries decision cost. The learner carries retrieval cost.**

NoteFlow is a note product and a learning conductor. The note and the learning card are not separate systems; they are two views of the same knowledge object:

- **Front:** a retrieval prompt that requires an attempt
- **Back:** the editable Markdown note used to compare, repair, and deepen the answer

## 2026 All Things Agentic hackathon entry

The `codex/all-things-agentic-hackathon` branch contains a separate Collaborative Partner entry built during the contest period. The original NoteFlow foundation is explicitly disclosed as pre-existing work; the entry claims only the new Google ADK, Gemini 3.5, Cloud Run, Firestore, Pub/Sub, and `/hackathon` experience.

- [Provenance and pre-existing work disclosure](HACKATHON_DISCLOSURE.md)
- [Dated development log](HACKATHON_DEVLOG.md)
- [Architecture diagram](docs/HACKATHON_ARCHITECTURE.md)
- [Agent service setup and Cloud Run deployment](hackathon-agent/README.md)
- [Submission readiness checklist](HACKATHON_SUBMISSION_CHECKLIST.md)

Open `/hackathon` after starting the web app. Without a configured Cloud Run URL, the page stays usable in a clearly labeled deterministic preview mode and never presents sample output as Gemini output.

The app now has two explicit workspaces:

- **笔记库:** create, search, import, tag, batch-manage, and edit the knowledge objects
- **学习:** choose a strategic goal boundary, then let the Flow Engine decide which object appears next

## Note format and bulk import

Every knowledge object has a required knowledge area (`skillId`) and a tag list:

- **Knowledge area:** one scheduling domain such as Intervals, Object Design, Spring / JWT, or Graphs
- **Tags:** zero or more free-form labels such as `heap`, `interview`, or `java`
- **Retrieval mode:** recall, solve, design, or speak
- **Front / back:** retrieval prompt and Markdown note

The library accepts:

- NoteFlow CSV with `title,prompt,noteMarkdown,skill,tags,mode,hintKeywords,scaffold`
- Anki CSV/TSV with `Front,Back,Tags`
- Anki-style headerless TSV ordered as Front, Back, Tags

Imports are previewed before saving. Unknown Deck or skill names are routed to a user-selected fallback area. Search results can be selected in bulk, moved to another area, tagged, or deleted. Deletion also removes the associated memory evidence and persists a tombstone for built-in objects.

## Goals, focus, and interview sprints

Before a session, the learner can:

- name a current goal, such as “Amazon SDE II technical interview”
- choose a role baseline
- switch between steady learning and interview sprint mode
- provide an interview date
- restrict the session to selected knowledge areas

The knowledge-area selection is a hard scheduling boundary, not a task list. Sprint mode raises the weight of goal-relevant gaps as the interview approaches, but the objective remains memory retention. Session length and willingness to continue never enter the ranking model.

## Product contract

- Nothing is “unfinished.” Cards not seen in a session simply return to the scheduling pool.
- No backlog, completion rate, overdue count, priority score, or visible queue is shown.
- Skip only moves a card to the end of the current in-memory session queue.
- Skip never changes the memory interval and never survives as a next-day obligation.
- Skip counts remain silent. Repeated skipping marks the card as needing decomposition.
- The answer side is inaccessible until the learner commits to an attempt.
- Numbers, timers, scores, and Skill State are hidden during retrieval.
- Reaction time is recorded automatically but never shown during the problem.
- Skill State appears only at session boundaries.
- Choosing whether to continue never enters the ranking model.

## Retrieval loop

```text
Prompt
  → learner commits: fluent / stuck
  → keyword cue
  → another retrieval attempt
  → scaffold cue if needed
  → another retrieval attempt
  → Markdown note back
  → memory feedback
  → post-retrieval delta
```

The three memory signals are:

- **I knew what I was looking for** → normal rescheduling
- **I had no direction** → retrieve a prerequisite first
- **This was overlearned** → expand the interval

This is not a difficulty rating. It tells the memory scheduler what kind of failure or success occurred.

## Notes repair themselves

An empty note back asks:

> 刚才卡在哪一句？

The answer becomes a smaller retrieval card in the same card pool. It is not added to a task list. A card skipped repeatedly is silently marked for decomposition, treating poor card design as a system problem rather than a learner failure.

## Authentication and database

NoteFlow supports two sign-in paths through Supabase Auth:

- **Google OAuth** for one-click sign-in
- **Email numeric OTP** with no password to create or remember

Authentication and product storage are deliberately separate:

- Supabase Auth owns identity, sessions, and the stable authenticated user ID.
- Cloudflare D1 owns notes, goals, Skill State, card memory, and learning evidence.
- `workspace_state` stores one independent JSON snapshot per verified Supabase user ID.
- The browser sends the current Supabase access token; `/api/state` verifies it with Supabase before choosing a D1 row.
- The client never supplies a workspace owner ID, and anonymous or invalid-token requests receive `401`.
- Browser `localStorage` is namespaced by the stable user ID and acts only as an offline cache.
- Recordings remain session-local. Imported CSV/TSV files are parsed in the browser; only the resulting knowledge objects are saved.

The D1 schema does not need a new table for authentication. Existing knowledge state remains one object with multiple views, not separate note and flashcard databases.

Full provider setup is documented in [`docs/AUTH_SETUP.md`](docs/AUTH_SETUP.md).

## Scheduling objective

```text
Hidden retrieval priority =
  retention need
  + goal relevance
  + mastery gap
  + dependency value
  + uncertainty reduction
  + sprint urgency when enabled
  - familiarity discount
```

The priority is never shown before retrieval.

## Authentication setup

Copy `.env.example` to `.env.local`, add the Supabase Project URL and Publishable Key, then follow [`docs/AUTH_SETUP.md`](docs/AUTH_SETUP.md) to enable Google and the `{{ .Token }}` email template.

## Run locally

```bash
pnpm install
pnpm dev
```

## Validate

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
```

## Core files

- `app/auth-gate.tsx` — Google OAuth, email OTP, session restoration, and sign-out
- `app/noteflow-app.tsx` — workspace navigation, session boundaries, commit gate, recording, and feedback
- `lib/supabase-auth.ts` — server-side bearer-token verification
- `app/note-library.tsx` — editable objects, import preview, tags, and batch management
- `lib/import-notes.ts` — NoteFlow CSV and Anki CSV/TSV parser
- `app/goal-planner.tsx` — custom goal, scope, and interview sprint controls
- `app/api/state/route.ts` — authenticated, per-user D1 state API
- `lib/flow-engine.ts` — retention-first ranking, focus boundaries, sprint urgency, and silent Skip
- `db/schema.ts` — D1 schema
- `tests/rendered-html.test.mjs` — production-render and product-constraint regressions

> **Don’t plan. Retrieve. Remember.**
