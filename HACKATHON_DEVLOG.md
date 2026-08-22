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

## 2026-08-22 — Unified English and Chinese experience

- Replaced the separate-language presentation with one shared locale layer across the entry page, authentication gate, guest workspace, note library, goal planner, and retrieval flow.
- Set English as the first-visit default and added an in-place English / Chinese switch that remembers the visitor's choice without changing routes or product behavior.
- Added locale-aware live-agent requests so Gemini answers in the language selected by the judge, including localized error and transparent-preview states.
- Rechecked the official submission rules: the application must support English, the hosted demo may use any publicly testable website URL, and a GitHub, GitLab, or Bitbucket repository URL is explicitly required. The rules do not require the frontend itself to be hosted by Google.
- Confirmed that GitHub Pages is a technical hosting constraint rather than a contest restriction: the current authenticated APIs and server-side Agent proxy cannot run on static Pages without a separate public backend boundary.
- Verified the production build, TypeScript compilation, and four automated tests. No new public deployment was made during this change.
- Unified bilingual experience commit: `7815e99` (`feat: unify English and Chinese experiences`).

## 2026-08-22 — Public judging flow repair

- Reviewed a real mobile capture showing that the public root route exposed an unconfigured Supabase sign-in surface.
- Replaced the root sign-in gate with the public hackathon product and moved the pre-existing personal-account flow to the optional `/account` route.
- Removed disabled Google and email controls from deployments without Supabase configuration; the optional account page now states honestly that guest learning remains available.
- Reduced the Agent intake to one explicit run action instead of a hidden two-click clarification sequence.
- Added a direct handoff from the Agent report to the guest learning workspace. The selected retrieval prompt, learning goal, source evidence, and Agent report now become a real practice card and open immediately in the retrieval flow.
- Verified the production build, TypeScript compilation, and five automated tests. This repair remains local and was not republished to the unwanted `chatgpt.site` address.
- Public judging flow repair commit: `05e82f7` (`fix: connect public Agent flow to learning`).

## Logging rules

- Add a dated entry for each material feature, deployment, or submission change.
- Link the relevant commit hash after each commit is created.
- Record failed experiments when they affect an architectural decision.
- Never backdate work or squash the contest-period development history before judging ends.
