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
- Verified the production build, TypeScript compilation, and five automated tests. No new public deployment was made during this repair.
- Public judging flow repair commit: `05e82f7` (`fix: connect public Agent flow to learning`).

## 2026-08-22 — Submission README refresh

- Rewrote the hackathon branch README as an English-first judge guide while retaining the in-place Chinese language option.
- Documented the no-account path from Agent evidence intake to a real retrieval card in `/demo`.
- Mapped Gemini 3.5 Flash, Google ADK, Cloud Run, Firestore, and Pub/Sub to their concrete roles and recorded the verified live-cloud evidence identifiers.
- Marked the independent public frontend deployment as pending instead of presenting the obsolete temporary host as the submission demo.
- Added explicit links between the stable `main` foundation and the separate contest-period branch.
- Submission README refresh commit: `0f9ec77` (`docs: refresh hackathon branch README`).

## 2026-08-22 — Standalone submission repository

- Prepared `Dollars7/NoteFlow-Agent-Hackathon-2026` as the public, judge-facing repository with the contest branch mapped to its `main` branch.
- Preserved the full inherited Git history and fixed pre-contest baseline instead of starting an untraceable clean history.
- Kept the original `Dollars7/NoteFlow` repository and its stable `main` branch unchanged.
- Updated repository links and the provenance disclosure for the standalone submission context.
- Standalone repository preparation commit: `3b06399` (`docs: prepare standalone hackathon repository`).

## 2026-08-22 — Repository consolidation

- Verified that `Dollars7/NoteFlow-Agent-Hackathon-2026` is public and uses `main` as its default branch before retiring the duplicate remote branch.
- Updated the original NoteFlow `main` README to point all contest links to the standalone repository in commit `fb777e1`.
- Deleted only the duplicate `codex/all-things-agentic-hackathon` branch from the original GitHub repository after it had no remaining README references.
- Retained the local source branch and the complete standalone repository history so the deleted remote branch remains recoverable.
- Repository consolidation record commit: `7ccfaf3` (`docs: record repository consolidation`).

## 2026-08-22 — Product-direction alignment

- Corrected the submission story from a one-shot evidence-to-retrieval assistant to the intended personal learning-rhythm partner.
- Documented the intended loop: learner-controlled context, adaptive rhythm, opt-in notification, NoteFlow retrieval, real memory feedback, and a revised future rhythm.
- Preserved the original NoteFlow responsibility: the Flow Engine chooses what to retrieve, while the Agent decides when to invite learning and how the rhythm adapts.
- Separated current working functionality from planned notification, scheduling, and feedback-loop work so the README does not overstate the deployed product.
- Added Vercel import guidance: deploy the repository-root web project only; keep `hackathon-agent` on Cloud Run.
- Product-direction alignment commit: `b49583e` (`docs: align submission with learning rhythm vision`).

## 2026-08-22 — Independent Vercel frontend deployment

- Imported the standalone `Dollars7/NoteFlow-Agent-Hackathon-2026` repository into the entrant's Vercel team as `note-flow-agent-hackathon-2026`.
- Configured only the server-side Cloud Run URL and shared bearer value; removed the obsolete detected `NEXT_PUBLIC_*` Agent variables.
- The first deployment (`dpl_2vaiFHR1TsWZLYiTjoTjDeW7CjLi`) failed after running the repository's Cloudflare-oriented `vinext build`, which did not produce Vercel's expected standard Next.js output.
- Preserved the existing Vinext build and tests, added a separate `next build` command for Vercel, and selected it through `vercel.json`.
- Verified the standard Next.js 16.2.6 production build locally, including `/`, `/hackathon`, `/demo`, `/account`, and both API routes.
- The second deployment (`dpl_9Fyqu9yM4XqCsAbmVFBSD4BMSTGD`) compiled the Next.js web app but failed when the root type checker entered `hackathon-agent/agent.ts` without the separately installed Cloud Run dependencies.
- Kept the deployment boundary clean by excluding `hackathon-agent` from the root web TypeScript project instead of installing backend-only Google packages in the Vercel frontend.
- The third source deployment reached `Ready` from commit `a00c23b` after the root TypeScript boundary was corrected.
- The first live browser run then returned HTTP 401. The Vercel sensitive value contained the 28-character environment-variable name rather than the existing 64-character Cloud Run shared value. Corrected the Vercel value without exposing either secret in the repository or this log.
- Redeployed production as `dpl_HfddW3RgbD8dN8tY2faiSS5XzHGW`; Vercel reported `Ready` and assigned the stable public domain `https://note-flow-agent-hackathon-2026.vercel.app`.
- Repeated the public judge path against the stable domain. Gemini returned `READY`, Firestore persisted immutable model version `8DopLuEwDZ4SVnk4eqyn`, and **Practice the next step** opened the exact Agent-selected retrieval in `/demo?source=agent`.
- Verified English-first rendering and the in-place Chinese interface switch on the deployed practice flow. The generated retrieval remained in the language selected when that Agent run began, as intended.
- Verified Vercel deployment record commit: `46bd09c` (`docs: record verified Vercel deployment`).

## 2026-08-22 — Adaptive learning-rhythm P0

- Replaced the one-shot planning form with learner-controlled context for learning preferences, constraints, short/fixed/energy-aligned pattern, session length, weekly cadence, energy window, invitation time, and reminder opt-in. The product explicitly treats this as self-description, not a personality or medical diagnosis.
- Extended the Google ADK persistence tool so Firestore versions contain both the knowledge model and a sustainable rhythm with load rule, preferred window, next invitation, reason, and notification mode.
- Added HMAC-signed browser continuation tokens. A public judge can answer a real Agent clarification or return retrieval feedback to the same high-entropy ADK session without receiving the Cloud Run shared secret.
- Returned real NoteFlow evidence—attempt outcome, scheduler feedback, hint depth, reaction time, and memory before/after—to Gemini. The practice page now shows the rhythm before and after the Agent mutation plus the revised next invitation.
- Added opt-in calendar invitations with a reminder alarm and lightweight browser reminder activation. Documented that production push or email delivery after every tab closes remains post-P0 work.
- Passed root and Agent TypeScript checks, the standard Next.js production build, the Vinext hosting build, and eight automated tests.
- Deployed Google Agent revision `noteflow-agent-00003-d6g` to 100% of Cloud Run traffic and confirmed both the Vercel-configured legacy service URL and the current Cloud Run URL return HTTP 200.
- Published P0 web commit `f9b2672` to the standalone repository. The stable Vercel domain served the new onboarding controls.
- Ran a live public P0 smoke test: the planning turn returned a signed continuation, rhythm, next invitation, and retrieval; the feedback continuation was accepted and returned a revised rhythm, invitation, and retrieval.
- P0 documentation and verification record commit: `bfaa338` (`docs: record adaptive rhythm P0`).

## 2026-08-23 — Judge-facing progress and readable Agent output

- Replaced the ambiguous response `WAITING` state with an explicit generating panel, active status, and a four-stage Agent Trace progress bar: ingest, clarify, synthesize, and mutate. The UI holds at synthesis while the cloud call is pending and marks mutation/100% only after a report returns.
- Rendered the Agent report, learning rhythm, and next invitation as a safe presentation subset of Markdown, including headings, rules, lists, blockquotes, bold, italics, and inline code.
- Added a native `noteflow-learning-plan.md` download containing the learning goal, rhythm metadata, and full Agent report.
- Replaced the unclear **Practice the next step** action with a preview of the exact first retrieval, an explicit **Start learning now** label, and copy explaining that the action opens NoteFlow retrieval mode immediately.
- Corrected section extraction so Markdown dividers do not leak into the rhythm card, then normalized blockquote, bullet, emphasis, and code markers before an Agent-selected prompt becomes a real NoteFlow card.
- Passed TypeScript, eight automated tests, the standard Next.js production build, and the Vinext compatibility build. Local browser QA verified generation, formatted report output, the Markdown export payload, and the direct Agent-to-retrieval handoff.
- Published judge-facing UX commit `b51ff43` (`feat: clarify generation and learning handoff`). A public Vercel smoke run advanced from 25% to 75% to 100%, returned a formatted Gemini report, persisted model version `8QBN2tHzgwmvjmNn79UX`, and exposed the `.md` export plus first-retrieval preview.
- The live smoke run revealed remaining single-asterisk emphasis and prompt markers; fixed them in follow-up commit `76fc5b3` (`fix: normalize markdown in retrieval prompts`). Vercel reported the final deployment successful on the stable public domain.

## 2026-08-25 — Natural-language plan review and explicit Session controls

- Replaced the intake's fixed quota fields with natural-language goal, evidence, learning preferences, and real constraints. The Google Agent now persists a reviewable `planSettings` object containing the inferred goal, optional role baseline, themes, continuous steady-to-sprint priority, session-duration range, invitation-frequency range, study pattern, energy window, preferred time, reminder preference, and evidence-grounded rationale.
- Added a real plan-review boundary between Agent generation and learning. **Review plan** opens `/demo` without starting retrieval; the learner can change generated ranges and then explicitly select **Start this session**.
- Kept both duration and invitation frequency as guidance rather than learning limits. The learner can voluntarily start another Session at any time.
- Split the ambiguous Skip control into two scheduler actions. **Later this session · move to queue end** rotates only when another card exists. **Skip for now · return to learning pool** removes the card from the current Session; if it is the only card, the Session ends and the card remains available for future scheduling.
- Passed root and Agent TypeScript checks, eight automated tests, the standard Next.js production build, and the Vinext compatibility build.
- Published implementation commit `9d118d8` (`feat: review generated plans before learning`) to the standalone repository `main`; Vercel reported the corresponding production deployment successful.
- Deployed Google Agent revision `noteflow-agent-00004-4hh` to 100% of Cloud Run traffic. Confirmed both the Vercel-configured service domain and the current Cloud Run domain return HTTP 200.
- Ran a public end-to-end planning smoke test through the stable Vercel domain. The signed continuation was returned, `persist_learning_model` executed, and the Agent produced a structured plan with a continuous priority value, `15–25` minute session range, `5–7` invitation range, short-frequent pattern, and three evidence-grounded themes.

## 2026-08-25 — Cloud Agent 503 reliability correction

- Investigated a real public planning failure reported by the learner. Cloud Run logs showed revision `noteflow-agent-00004-4hh` reached `1041 MiB`, exceeded its `1 GiB` limit, and was terminated while `/run` was active; Vercel correctly surfaced the resulting upstream HTTP 503.
- Kept the existing Vercel and server-only proxy boundary unchanged. Updated only the Cloud Run runtime envelope: `2 GiB` memory, concurrency `1` per instance, and a maximum of `2` instances so simultaneous judge runs cannot share and exhaust one Agent process.
- Deployed revision `noteflow-agent-00005-l5v` and confirmed it serves 100% of traffic with the intended settings.
- Reproduced the original risk condition with two simultaneous public planning requests through the stable Vercel domain. Both returned HTTP 200, Agent events, and signed continuations; neither returned an error or 503.

## 2026-08-25 — Simplified planning surface, language boundary, and data provenance

- Replaced the prefilled backend-interview form with empty required fields and simple placeholders. Renamed **Unstructured evidence** to **What are you learning or getting stuck on?** and kept the generate action disabled until the learner supplies a goal and at least one real note, question, or stuck point.
- Collapsed optional learning preferences and constraints into **More settings**. On the review page, kept the goal, steady-to-sprint priority, and Session-length sliders in the primary flow; moved reminder frequency, pattern, timing, role baseline, and themes into a second **More settings** disclosure.
- Renamed user-facing invitation terminology to **Study reminder**. Internal persisted field names remain backward-compatible, while the interface now uses reminder frequency, preferred reminder time, and next study reminder.
- Replaced the long default Agent report with a concise goal, rationale, focus, Session length, and reminder summary. The full Markdown report remains available only under **Agent details and audit trail** and as a `.md` download.
- Removed the full Agent report and raw source notes from the retrieval card back. The card now shows only why that practice was selected and the inferred learning focus.
- Bound generated content to the language used for that Agent run. Changing language on the entry page clears the previous generated presentation, and the Agent handoff aligns and locks the practice UI to the content language.
- Made persistence provenance explicit: Firestore stores contest-period Agent models and immutable versions; guest handoff and retrieval state stay in the browser; Supabase is pre-existing authentication; Cloudflare D1 is not mounted on the Vercel judge deployment; initial skills and cards are disclosed demo seed data.
- Passed root and Agent TypeScript checks, eight automated tests, the standard Next.js production build, and the Vinext compatibility build. Published implementation commit `82e919a` (`feat: simplify plan flow and lock content language`) and confirmed the Vercel deployment succeeded.
- Ran a public validation through the stable domain: empty learning material returned HTTP 400, while a simple English planning run returned HTTP 200, a signed continuation, and structured plan settings. The final English Agent report contained no Chinese characters.

## 2026-08-28 — Submission drafts and final-deliverable alignment

- Prepared a copy-ready English Devpost draft covering the problem, value, Collaborative Partner fit, Google technology, architecture, data sources, testing instructions, findings, future work, and explicit pre-existing-foundation boundary.
- Prepared a timed English demo script targeting 3:45–3:55, including an unedited public Agent run and visible Cloud Run, Firestore, Pub/Sub, and private-worker completion evidence.
- Added a recording safety checklist so the video does not expose service secrets, environment values, billing details, private notes, or personal identifiers.
- Rechecked the production demo and public standalone repository before drafting. Both were publicly reachable, and the hosted product rendered the latest default-English simplified planning flow.
- Updated the internal submission tracker to reflect that the standalone repository is already public. Final submission remains pending the recorded public video and Devpost form review.
- Produced a judge-facing 3:2 PNG architecture diagram showing the public Vercel flow, server-only proxy, Google ADK and Gemini service on Cloud Run, Firestore versions, Pub/Sub queue, private OIDC worker, browser-state boundary, feedback loop, and verified cloud proof identifiers.
- Reworked the first dense diagram after visual review. The final two-layer layout separates the five-step learning loop from the deployed Google Cloud path, removes internal proof identifiers from the main composition, and gives the Agent judgment and feedback-driven mutation visual priority.

## 2026-08-29 — Clean-machine reproducibility and submission alignment

- Unified the repository and Agent service on Node.js 24.13+, added `.nvmrc`, and aligned the documented install and validation commands with a clean checkout.
- Restricted local ADK discovery to `agent.ts`; verified the service starts without the Cloud Run shared secret and returns HTTP 200 with `["agent"]` from `/list-apps`.
- Added the three Agent-entry assertions to the default suite. All 13 automated tests, full lint, root and Agent TypeScript checks, Vinext compatibility build, and Vercel production build passed.
- Removed the obsolete OpenAI hosting project file and its build/test coupling, aligned `.env.example` with the server-only Agent variables, and moved the submission tracker out of the judge-facing README.
- Updated README, Devpost draft, architecture documentation, and the judge-facing diagram for multi-card sessions, native `.apkg` ingestion, signed feedback continuation, and the mandatory Google technology stack. Reflowed the README diagrams into a three-layer deployed path and a compact repeating learner loop.

## Logging rules

- Add a dated entry for each material feature, deployment, or submission change.
- Link the relevant commit hash after each commit is created.
- Record failed experiments when they affect an architectural decision.
- Never backdate work or squash the contest-period development history before judging ends.
