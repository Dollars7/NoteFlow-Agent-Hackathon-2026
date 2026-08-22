# Hackathon development log

All timestamps use America/Phoenix (UTC-07:00 during the contest). This log records contest-period work without altering the earlier NoteFlow history.

## 2026-08-18 — Entry foundation

- Created branch `codex/all-things-agentic-hackathon` from pre-contest baseline `c42c840`.
- Reviewed the official contest requirements and selected Collaborative Partner.
- Verified the current official Google stack: Gemini 3.5 Flash and Google ADK for TypeScript.
- Created the public hackathon workflow page with a clearly labeled local preview mode.
- Created the separate ADK agent service with Firestore mutation and Pub/Sub background-job tools.
- Added an authenticated Cloud Run background-worker entry point that consumes Pub/Sub push messages, performs Gemini analysis, and writes results to Firestore.
- Added provenance disclosure, architecture, and reproducibility documentation.
- Generated a dedicated NoteFlow Agent social preview card and connected route-specific metadata.
- Verified the production web build, five automated tests, ADK `/list-apps`, ADK session creation, and the worker `/healthz` endpoint.
- Provenance baseline commit: `faf440f` (`chore: establish transparent hackathon baseline`).
- Public experience commit: `b37acae` (`feat: add collaborative partner hackathon experience`).
- Google agent and cloud workflow commit: `62b3ee5` (`feat: add Google ADK learning partner service`).

## 2026-08-22 — Live Google Cloud evidence

- Connected entrant-owned billing project `project-0069ddaa-e176-4b98-9db` without adding API keys or service-account files to the repository.
- Created a deletion-protected Firestore Native database in `us-central1`, the `noteflow-deep-analysis` Pub/Sub topic, and separate least-privilege runtime identities for the interactive agent, background worker, and Pub/Sub invoker.
- Added a server-only bearer boundary between the public Sites frontend and the Cloud Run ADK API server.
- Added the public `/demo` route so judges can use the disclosed pre-existing retrieval-first learning workspace without creating an account.
- The first source deployment was blocked because the new-project build identity could not read the Cloud Run source bucket. Fixed it with bucket-scoped object-viewer permission plus repository-scoped Artifact Registry writer and log-writer permissions.
- The first running revision restarted when the ADK loader scanned `background-worker.mjs` as an agent entry point. Fixed it by isolating `agent.ts` under the container’s `agents/agent/` directory.
- Deployed the corrected ADK service and a separate private background worker to Cloud Run with zero minimum instances and one maximum instance each.
- Verified a real Gemini 3.5 Flash run: immutable mutation `9aPqpj5FpIXwgGf89HVQ`, Pub/Sub message `21517632790505643`, worker HTTP 204, and Firestore background status `complete` at `2026-08-22T17:43:24.168Z`.
- Live cloud and guest-learning commit: `70238f84ed4dff20357c6644644e2164016df132` (`feat: deploy live hackathon learning agent`).

## Logging rules

- Add a dated entry for each material feature, deployment, or submission change.
- Link the relevant commit hash after each commit is created.
- Record failed experiments when they affect an architectural decision.
- Never backdate work or squash the contest-period development history before judging ends.
