# NoteFlow Agent — Build a learning rhythm that adapts to you

> **Plan the rhythm, not the backlog. Let NoteFlow choose the next retrieval.**

This is the standalone submission repository for the **2026 All Things Agentic Hackathon**, entered in the **Collaborative Partner** category.

Repository: [`Dollars7/NoteFlow-Agent-Hackathon-2026`](https://github.com/Dollars7/NoteFlow-Agent-Hackathon-2026) · submission branch: `main`

Hosted demo: **[note-flow-agent-hackathon-2026.vercel.app](https://note-flow-agent-hackathon-2026.vercel.app)**

NoteFlow Agent is intended to learn **when and how a person can study sustainably**, create a personal learning rhythm, invite the learner back at the right moment, and then use the existing NoteFlow retrieval flow to decide what should be practiced.

It is not meant to be a pasted-notes report generator. The Agent should adapt the plan from real learning behavior.

## Intended product loop

1. The learner defines a goal and provides self-described preferences, habits, constraints, available time, and daily energy patterns.
2. The Agent asks only the clarifying questions that would change the plan.
3. The Agent creates a sustainable rhythm—for example, short frequent sessions, a fixed daily window, or sessions aligned with the learner's reported high-energy periods.
4. A notification invites the learner to begin; it does not create an overdue task.
5. NoteFlow starts a retrieval session and selects the next knowledge object from memory evidence and goal relevance.
6. The learner's attempt, stuck point, skip, and memory feedback return to the Agent.
7. The Agent revises timing, session load, knowledge scope, and the next invitation.
8. Longer analysis can continue asynchronously and update the future rhythm after the learner leaves.

```text
Goal + personal learning context
  → adaptive rhythm
  → notification
  → NoteFlow retrieval session
  → real memory evidence
  → Agent revises the rhythm
```

The learner profile is self-reported product context, not a medical, neurological, or psychological diagnosis.

## What changes from the original NoteFlow

| Original NoteFlow foundation | Hackathon Agent direction |
| --- | --- |
| Retrieval-first note and card system | Personal learning-rhythm partner |
| Deterministic Flow Engine chooses the next card | Agent decides when to invite learning and how much load to propose |
| Goal filters and interview sprint controls | Adaptive plan based on preferences, constraints, availability, and observed behavior |
| Feedback reschedules memory objects | Feedback also revises the Agent's future rhythm |
| User opens the app to begin | Notification brings the learner back at an appropriate time |

The original Flow Engine remains responsible for **what to retrieve now**. The Agent becomes responsible for **when to invite learning, why the rhythm should change, and how the plan adapts over time**.

## Product rules

- A learning plan is a rhythm, not a task backlog.
- Missing a notification never becomes an overdue obligation.
- The Agent may recommend session size, but it must not punish the learner for stopping.
- Retrieval evidence is more important than a personality label.
- The learner can inspect and change the assumptions used by the Agent.
- Notifications and background work must be opt-in and explainable.

## Current implementation status

### Working now

- default-English public experience with an in-place Chinese switch;
- no-account judging and guest-practice path;
- goal and unstructured-evidence intake;
- Gemini 3.5 Flash reasoning through Google ADK;
- Firestore current-model mutation plus immutable versions;
- Pub/Sub asynchronous analysis delivered to a private Cloud Run worker;
- direct handoff from an Agent-selected retrieval prompt into the existing NoteFlow practice flow;
- transparent preview labeling when the live Agent connection is absent.

### Required next to deliver the intended product

- learner-context onboarding for preferences, constraints, availability, and self-reported energy windows;
- an Agent-generated clarification turn instead of only a prewritten optional question;
- a persisted rhythm and schedule model;
- opt-in notification delivery;
- practice outcomes sent back to the Google Agent;
- visible before-and-after plan changes;
- completed background analysis reflected in the learner's next session.

Until these items are implemented, the current build demonstrates the Agent infrastructure and the first Agent-to-practice handoff, not the complete adaptive learning-rhythm promise.

## Current working judge path

No account is required.

1. Open the [hosted demo](https://note-flow-agent-hackathon-2026.vercel.app) (the root page and `/hackathon` show the same judge flow).
2. Keep English or switch the same interface to Chinese.
3. Enter a learning goal and unstructured learning evidence.
4. Run NoteFlow Agent.
5. Review the Agent response and auditable model action.
6. Select **Practice the next step**.
7. NoteFlow opens `/demo` and starts the Agent-selected retrieval card.

`/account` is an optional personal-account route. Supabase is not required for judging or guest practice.

## Google technology

| Technology | Current role |
| --- | --- |
| Gemini 3.5 Flash through Vertex AI | Interactive evidence reasoning and background analysis |
| Google ADK for TypeScript | Agent orchestration and scoped function tools |
| Cloud Run | Interactive ADK API service and separate private worker |
| Firestore | Current learning model, immutable model versions, and completed analyses |
| Pub/Sub | Safe-digest asynchronous analysis jobs delivered with OIDC |

The browser never receives Google Cloud credentials, the Cloud Run URL, or the shared service token. A same-origin server route owns that boundary.

## Verified live-cloud evidence

The Google Agent stack is running in entrant-owned billing project `project-0069ddaa-e176-4b98-9db`.

- Firestore immutable mutation: `9aPqpj5FpIXwgGf89HVQ`
- Pub/Sub message: `21517632790505643`
- background status: `complete`
- completion time: `2026-08-22T17:43:24.168Z`

These identifiers prove the current evidence-to-model-to-background-job path. They do not claim that the planned notification and feedback loop is already implemented.

The independent Vercel production deployment was also tested end to end on August 22, 2026. A public judge run returned `READY`, persisted immutable Firestore model version `8DopLuEwDZ4SVnk4eqyn`, and handed the Agent-selected retrieval prompt into `/demo?source=agent`.

## Hosted demo and Vercel boundary

The current submission URL is:

```text
https://note-flow-agent-hackathon-2026.vercel.app
```

Vercel may report two deployable directories in this repository:

1. **Import `NoteFlow-Agent-Hackathon-2026`** — this is the repository-root web experience.
2. **Do not import `hackathon-agent` as a second Vercel website** — that directory is the protected Google ADK backend and belongs on Cloud Run.

Configure these as server-only variables on the root web project:

```text
NOTEFLOW_AGENT_URL
NOTEFLOW_AGENT_SHARED_SECRET
```

Do not expose either value with a `NEXT_PUBLIC_` prefix. A Vercel import is not considered complete until the root page, `/api/hackathon-agent`, the live Agent run, and the handoff to `/demo` have all been verified.

The old `chatgpt.site` deployment is not the current submission URL.

## Architecture

Current deployed Agent path:

```mermaid
flowchart LR
    Web["Bilingual web flow"] --> Proxy["Same-origin server boundary"]
    Proxy --> API["Google ADK on Cloud Run"]
    API --> Gemini["Gemini 3.5 Flash"]
    API --> Firestore[("Firestore model versions")]
    API --> PubSub[["Pub/Sub job"]]
    PubSub --> Worker["Private Cloud Run worker"]
    Worker --> Firestore
    API --> Web
    Web --> Practice["NoteFlow retrieval in /demo"]
```

Target experience extension:

```mermaid
flowchart LR
    Context["Goal + learning context"] --> Rhythm["Adaptive rhythm"]
    Rhythm --> Notice["Opt-in notification"]
    Notice --> Flow["NoteFlow retrieval flow"]
    Flow --> Evidence["Attempt + memory feedback"]
    Evidence --> Rhythm
```

See the detailed [current architecture and trust boundaries](docs/HACKATHON_ARCHITECTURE.md).

## Run the web app locally

Prerequisites: Node.js 22.13+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Without the server-only Agent variables, the interface uses clearly labeled preview output.

## Run the Google ADK service locally

Prerequisites: Node.js 24.13+, pnpm 11.19+, a Google Cloud project, and Application Default Credentials.

```bash
cd hackathon-agent
pnpm --ignore-workspace install
pnpm test
pnpm dev
```

Confirm `http://localhost:8000/list-apps` returns `["agent"]`. Complete backend instructions are in the [Agent service README](hackathon-agent/README.md).

## Validate

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
```

## Transparent development record

The earlier NoteFlow product is disclosed as pre-existing work. The repository retains its history and does not present the retrieval foundation as contest-period development.

- [Pre-existing work and claim boundary](HACKATHON_DISCLOSURE.md)
- [Dated, commit-linked development log](HACKATHON_DEVLOG.md)
- [Architecture and contest technology mapping](docs/HACKATHON_ARCHITECTURE.md)
- [Google Agent service and reproduction steps](hackathon-agent/README.md)
- [Submission readiness checklist](HACKATHON_SUBMISSION_CHECKLIST.md)
- Pre-contest baseline: `c42c840c2d881207ed6763a3280d198bc1189bfc`

The stable pre-contest product remains in the original [`Dollars7/NoteFlow`](https://github.com/Dollars7/NoteFlow/tree/main) repository.

> **Plan the rhythm. Enter the Flow. Remember.**
