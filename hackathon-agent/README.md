# NoteFlow Google ADK backend

This directory contains the protected Google Agent backend for the 2026 All Things Agentic Hackathon entry. It is intentionally separate from both the repository-root web experience and the pre-existing NoteFlow retrieval application.

## Deployment boundary

**Do not import `hackathon-agent` as a Vercel website.**

If Vercel detects two deployable directories, import only the repository-root `NoteFlow-Agent-Hackathon-2026` web project. This directory runs on Google Cloud Run because it requires Google service identity, private server credentials, Firestore, Pub/Sub, and an authenticated worker boundary.

The web project reaches this service through its same-origin server route. The browser must never receive the Cloud Run URL or shared bearer value.

## Current backend responsibility

The implemented Agent currently:

- uses Gemini 3.5 Flash through Vertex AI;
- synthesizes a learner goal, unstructured evidence, and optional clarification;
- infers reviewable plan settings from natural language: optional role baseline, themes, continuous steady-to-sprint priority, session-duration and invitation-frequency ranges, study pattern, energy window, and reminder preference;
- infers concepts, gaps, and prerequisite relationships;
- turns learner-controlled preferences, constraints, cadence, energy window, and invitation time into a sustainable rhythm;
- selects one high-value retrieval prompt;
- persists the current learning model, reviewable plan settings, rhythm, next invitation, and an immutable version in Firestore;
- accepts completed NoteFlow retrieval evidence through a signed continuation session;
- revises the rhythm and knowledge path from attempt outcome, hint depth, reaction time, memory feedback, and before/after memory state;
- queues safe-digest background analysis through Pub/Sub when useful;
- lets a separate private Cloud Run worker call Gemini and store completed analysis.

The web experience can produce an opt-in calendar invitation and a lightweight browser reminder. The backend does **not yet** operate a durable push or email notification channel after all browser tabs are closed.

## Intended next responsibility

After P0, the Agent will additionally need to:

- schedule durable opt-in push or email invitations without generating overdue tasks;
- preserve one learner's rhythm across devices through an account-linked identity;
- adapt from several sessions of evidence rather than only the immediate completed retrieval;
- surface background results in a future session.

These are documented product requirements, not claims about the current deployment.

## Google stack

- Gemini 3.5 Flash through Vertex AI
- Google ADK for TypeScript
- Cloud Run for the protected ADK API server
- Firestore for current and immutable learning-model versions
- Pub/Sub for asynchronous deep-analysis jobs
- A separate authenticated Cloud Run worker that consumes Pub/Sub push events and writes completed analysis to Firestore

## Run locally

Prerequisites: Node.js 24.13+, pnpm 11.19+, a Google Cloud project, and Application Default Credentials.

1. Copy `.env.example` to `.env` and set the Google Cloud project ID.
2. Authenticate locally with Application Default Credentials.
3. Enable Vertex AI, Firestore, Pub/Sub, Cloud Run, Cloud Build, and Artifact Registry APIs.
4. Create a Firestore Native database in the project.
5. Create the Pub/Sub topic `noteflow-deep-analysis`.
6. Install dependencies with `pnpm install --frozen-lockfile`. The nested workspace allow-list permits the required native build scripts without an interactive approval step.
7. Start the local ADK API server with `pnpm dev`.
8. Confirm `http://localhost:8000/list-apps` returns `["agent"]`.

The server accepts the standard ADK session and `/run` endpoints. No cloud write is reported as successful unless Firestore or Pub/Sub confirms it.

`pnpm dev` loads only `agent.ts` and does not require `NOTEFLOW_AGENT_SHARED_SECRET`. That secret is required only by the Cloud Run HTTP entry point, `node server.mjs`.

The worker can be smoke-tested without invoking Gemini by starting `pnpm worker` and requesting `/healthz`.

## Deploy the interactive service to Cloud Run

The Dockerfile copies `agent.ts` into an isolated `agents/agent/` directory and starts the authenticated ADK API server in `server.mjs`.

Deploy this directory to Cloud Run with:

- the project and Vertex AI location configured;
- a generated `NOTEFLOW_AGENT_SHARED_SECRET` runtime value;
- minimum instances set to zero and a small maximum instance cap for the public demo;
- a service identity with only the required Firestore and Pub/Sub permissions.

After deployment:

1. Store the Cloud Run URL as server-only `NOTEFLOW_AGENT_URL` on the root web deployment.
2. Store the same generated value as `NOTEFLOW_AGENT_SHARED_SECRET` on both Cloud Run and the root web deployment.
3. Verify a live run produces both a Firestore version document and a Pub/Sub message.

Do not prefix these values with `NEXT_PUBLIC_`.

## Deploy the background worker

Deploy `background-worker.mjs` as a second authenticated Cloud Run service using `pnpm worker` as its start command.

Create a Pub/Sub push subscription for `noteflow-deep-analysis` that:

- targets the private worker URL;
- uses an OIDC service account with Cloud Run Invoker permission;
- sends only a safe digest, not raw private notes.

Pub/Sub should be the worker's only caller.

Never commit API keys, service-account JSON files, `.env`, or shared bearer values.
