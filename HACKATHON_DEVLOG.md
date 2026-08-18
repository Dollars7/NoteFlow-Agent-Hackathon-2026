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

## Logging rules

- Add a dated entry for each material feature, deployment, or submission change.
- Link the relevant commit hash after each commit is created.
- Record failed experiments when they affect an architectural decision.
- Never backdate work or squash the contest-period development history before judging ends.
