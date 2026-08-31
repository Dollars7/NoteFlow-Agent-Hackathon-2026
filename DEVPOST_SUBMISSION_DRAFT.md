# Devpost submission draft

> Status: copy-ready draft. Replace only the bracketed video placeholder before final submission.

## Submission essentials

- **Project name:** NoteFlow Agent
- **Tagline:** Plan the rhythm, not the backlog. Let NoteFlow choose today's retrieval session.
- **Category:** Collaborative Partner
- **Required Google stack:** Gemini 3.5 Flash (Vertex AI) · Google ADK for TypeScript · Cloud Run + Firestore + Pub/Sub
- **Hosted project:** https://note-flow-agent-hackathon-2026.vercel.app
- **Source repository:** https://github.com/Dollars7/NoteFlow-Agent-Hackathon-2026
- **Demo video:** https://www.youtube.com/watch?v=j2gfKoYyCZQ
- **Architecture:** https://github.com/Dollars7/NoteFlow-Agent-Hackathon-2026/blob/main/docs/HACKATHON_ARCHITECTURE.md

## Short summary

NoteFlow Agent turns a learner's messy notes, stuck points, preferences, and real-life constraints into an adjustable learning rhythm. Instead of creating a backlog or punishing missed study reminders, it proposes a range-based plan, selects a small retrieval session, observes the learner's real attempts, and mutates the future rhythm from that evidence.

The contest-period Agent uses Gemini 3.5 Flash through Google ADK on Cloud Run. It persists current and immutable learning-model versions in Firestore and can queue safe-digest background analysis through Pub/Sub to a separate private Cloud Run worker.

## Inspiration

Most learning planners ask people to maintain another task list. Most flashcard tools optimize what is due, but they do not understand when a learner has energy, which constraints make a plan unsustainable, or how a real retrieval attempt should change the next session.

I wanted a learning partner that treats a plan as a rhythm rather than a debt ledger. Missing a reminder should never become overdue work. The system should notice where the learner gets stuck, ask only the clarification that would change the path, and then adapt from actual memory evidence rather than from a fixed personality label.

## What it does

1. The learner enters a goal and at least one real note, question, or stuck point, or imports existing material from CSV, Anki text exports, or a native `.apkg` package. Learning preferences and constraints are optional natural-language context.
2. NoteFlow Agent ingests the unstructured evidence and asks a clarification only when the answer would materially change the learning path.
3. The Agent synthesizes an editable plan: goal, optional role baseline, themes, a continuous steady-to-sprint priority, a session-duration range, reminder frequency, study pattern, energy window, and reminder preference.
4. The learner reviews the generated ranges before explicitly starting a learning session.
5. The Agent generates structured cards by theme and hands a small, ranked retrieval session into the no-account NoteFlow practice flow.
6. The learner's attempt outcome, hint depth, reaction time, skip behavior, and memory feedback return to the same signed Agent session.
7. The Agent mutates the knowledge model and future rhythm. The interface shows the before-and-after change and the revised next reminder.
8. When deeper analysis is useful, the Agent publishes a privacy-reduced digest to Pub/Sub. A separate authenticated Cloud Run worker completes the analysis and writes the result to Firestore.

The current build also offers opt-in calendar and browser reminders. It does not claim durable server push after every browser tab is closed.

## Why it is agentic

NoteFlow Agent does more than produce a report or continue a chat:

- **It leads with judgment.** It decides whether a clarification is necessary instead of asking a fixed questionnaire.
- **It mutates a learning representation.** Scoped ADK tools write a current model and an immutable model version to Firestore.
- **It takes asynchronous action.** Pub/Sub can hand safe-digest analysis to a separate private worker after the interactive response.
- **It closes the feedback loop.** Retrieval evidence returns to the same Agent session and changes future timing, load, scope, and the next study reminder.
- **It preserves learner control.** The generated plan is reviewable and editable, and practice never starts until the learner explicitly confirms it.

## How I built it

The retrieval workspace predates the contest and is disclosed in `HACKATHON_DISCLOSURE.md`; during the contest it was reworked into a goal-scoped, multi-card Agent handoff with visible card origins and native `.apkg` ingestion. The public Next.js interface is deployed on Vercel. Its same-origin server route is the only public caller of the protected Agent API, so the browser never receives Google Cloud credentials, the Cloud Run service URL, or the shared service token.

The interactive backend runs as a Google ADK for TypeScript service on Cloud Run and uses Gemini 3.5 Flash through Vertex AI. The Agent has two scoped tools:

- `persist_learning_model` writes the current knowledge model, generated plan, rhythm, and a separate immutable version to Firestore.
- `queue_deep_analysis` publishes a safe source digest to Pub/Sub instead of copying raw private notes into the queue.

An authenticated Pub/Sub push subscription invokes a separate private Cloud Run worker with OIDC. The worker calls Gemini for the longer analysis and stores its completed result in Firestore. Public retrieval feedback returns through an HMAC-signed continuation token with a high-entropy session identifier; it never exposes the server credential.

The no-account judge flow uses browser storage for its temporary handoff and retrieval state. Firestore remains the source of truth for contest-period Agent mutations and background results.

## Google technology used

- Gemini 3.5 Flash through Vertex AI
- Google ADK for TypeScript
- Google Cloud Run for the interactive Agent API
- Google Cloud Run for a separate private background worker
- Google Firestore for current models, immutable versions, and completed analyses
- Google Pub/Sub for safe-digest asynchronous jobs
- Google Cloud service identities and OIDC for protected service-to-service calls

Additional web technology: Next.js, React, TypeScript, Vercel, and browser storage for the temporary no-account judge session.

## Architecture and data flow

```text
Learner
  -> public NoteFlow web flow
  -> same-origin protected proxy
  -> Google ADK + Gemini 3.5 Flash on Cloud Run
       -> current model + immutable version in Firestore
       -> safe digest in Pub/Sub
            -> private Cloud Run worker
            -> completed analysis in Firestore
  -> editable plan review
  -> NoteFlow retrieval session
  -> attempt and memory evidence back to the same Agent session
  -> visibly revised rhythm
```

The complete diagram and trust boundaries are available in the repository's architecture document.

## Data sources and persistence disclosure

The Agent reasons over learner-provided content: a learning goal, free-form notes or stuck points, optional self-described learning preferences, constraints, and subsequent retrieval feedback. No external proprietary dataset is required.

- Firestore stores contest-period Agent knowledge models, generated plan settings, rhythms, immutable versions, and completed background analyses.
- Browser storage holds the temporary no-account handoff and guest retrieval state.
- The initial guest skills and cards are disclosed pre-existing repository seed data.
- Supabase authentication and Cloudflare D1 persistence belong to the pre-existing optional account route and are not required or mounted for the public judging path.
- Pub/Sub messages contain only a safe source digest, not raw private notes.

The learner profile is self-described product context, not a medical, neurological, or psychological diagnosis.

## Pre-existing work disclosure

The original NoteFlow retrieval-first application existed before the submission period. Its note library, import tools, deterministic Flow Engine, retrieval session interface, memory feedback, account authentication, and existing visual shell are disclosed as pre-existing work.

The work submitted for this hackathon is the newly created autonomous Agent layer and its public judging experience: Gemini 3.5 behavior and prompts, Google ADK tools, Firestore model mutation and immutable history, Pub/Sub background analysis, Cloud Run services, signed feedback continuation, generated-plan review, visible rhythm adaptation, architecture, reproducibility instructions, and cloud execution evidence.

The repository preserves the pre-contest baseline and dated development history so judges can inspect this boundary directly:

- https://github.com/Dollars7/NoteFlow-Agent-Hackathon-2026/blob/main/HACKATHON_DISCLOSURE.md
- https://github.com/Dollars7/NoteFlow-Agent-Hackathon-2026/blob/main/HACKATHON_DEVLOG.md

## Challenges I ran into

The hardest product problem was avoiding a polished report generator. The first designs produced useful diagnoses but moved too quickly into practice and exposed too many settings at once. I changed the flow so natural-language context comes first, the Agent proposes adjustable ranges, and the learner crosses an explicit review boundary before the session begins.

The hardest infrastructure problem was keeping the Agent reliable without exposing credentials. A real Cloud Run run exceeded a 1 GiB memory limit and returned a 503. Cloud logs identified the cause; I raised the service to 2 GiB, limited each instance to one concurrent Agent run, allowed two instances, and verified simultaneous public requests. I also separated the public proxy, interactive Agent, Pub/Sub queue, and private worker so each trust boundary remains narrow.

Language continuity was another subtle problem. The interface now locks generated content and the practice handoff to the language selected for that Agent run, so an English session cannot silently reuse a Chinese result or vice versa.

## Accomplishments that I am proud of

- A complete no-account loop from messy evidence to an editable rhythm, an Agent-selected multi-card session, real learner feedback, and a visibly revised rhythm.
- Real Firestore mutations with immutable version identifiers rather than simulated success messages; judges can inspect example immutable version `9aPqpj5FpIXwgGf89HVQ`.
- A real Pub/Sub job (`21517632790505643`) delivered with OIDC to a private worker and completed in Firestore.
- A server-only credential boundary: the browser receives neither Google credentials nor the shared Cloud Run secret.
- Transparent separation between the pre-existing NoteFlow foundation and the contest-period Agent system.
- A default-English experience with an in-place Chinese translation and language-safe generated state.

## What I learned

Agentic learning software needs a clear boundary between recommendation and learner consent. Generating a plan is not the same as starting a session. Range-based recommendations also fit real life better than fixed quotas: they can guide a learner without turning voluntary learning into overdue work.

Technically, persistent state and proof of action matter more than an impressive chat response. Firestore versions, Pub/Sub message IDs, private-worker completion, signed continuation, and visible before-and-after adaptation make the Agent's actions auditable. I also learned that traceable failure evidence is valuable: Cloud Run logs turned a vague public 503 into a concrete memory and concurrency fix.

## What's next

- Add durable account-linked rhythm continuity across devices.
- Deliver opt-in server reminders after all NoteFlow tabs are closed.
- Adapt from several weeks of retrieval evidence and completed background analysis.
- Add learner-facing retention, export, and deletion controls for cloud Agent history.

## Testing instructions for judges

No account or credentials are required.

1. Open https://note-flow-agent-hackathon-2026.vercel.app.
2. Keep English selected.
3. Enter a learning goal and at least one real note, question, or stuck point. Optional learning preferences and constraints are under **More settings**.
4. Select **Build my learning path** and follow one real clarification if the Agent determines it is necessary.
5. Review the generated summary. The full report and audit trail remain collapsed.
6. Select **Review plan**. Adjust the priority or session-duration range if desired.
7. Select **Start this session** to open the Agent-selected retrieval.
8. Complete the retrieval and feedback. Observe the rhythm before and after the Agent revision.

If using the card controls, **Later this session** moves the card to the current queue end only when another card exists. **Skip for now** removes it from the current session and returns it to the future learning pool.

## Reproducibility

The repository README contains step-by-step local web setup, Google ADK service setup, Cloud Run boundaries, required server-only variables, validation commands, and the detailed architecture diagram:

https://github.com/Dollars7/NoteFlow-Agent-Hackathon-2026#readme

## Verified cloud proof for the video

- Google Cloud project: `project-0069ddaa-e176-4b98-9db`
- Firestore immutable mutation: `9aPqpj5FpIXwgGf89HVQ`
- Pub/Sub message: `21517632790505643`
- Background status: `complete`
- Completion time: `2026-08-22T17:43:24.168Z`
- Later production model version: `8DopLuEwDZ4SVnk4eqyn`

Do not paste service secrets, bearer tokens, environment-variable values, or private note contents into the Devpost form or demonstration video.
