# Hackathon provenance and pre-existing work disclosure

This document is part of the submission evidence for the 2026 All Things Agentic Hackathon. It intentionally distinguishes the pre-existing NoteFlow product from work created during the submission period.

## Fixed pre-contest baseline

- Baseline commit: `c42c840c2d881207ed6763a3280d198bc1189bfc`
- Baseline commit date: 2026-07-23 14:29:23 -07:00
- Hackathon branch created: 2026-08-18
- Hackathon branch: `codex/all-things-agentic-hackathon`
- Standalone submission repository: `Dollars7/NoteFlow-Agent-Hackathon-2026`
- Standalone repository source point: `c4a37a94ef86eacb6ef5b0ec8321dd9066a10fe1`

The standalone repository retains the history before the branch point. It must not be rewritten or presented as contest-period work. The original `Dollars7/NoteFlow` repository also remains intact.

## Pre-existing NoteFlow components

The following existed before the submission period and are disclosed as pre-existing work:

- Note library, CSV/Anki import, tags, and batch editing
- Retrieval-first learning session interface
- Deterministic Flow Engine ranking and memory feedback
- Goal and interview-sprint controls
- Supabase authentication
- Cloudflare D1 workspace persistence
- Existing visual identity and general web application shell

## Newly created hackathon scope

The contest entry claims only work developed during the submission period, including:

- Public `/hackathon` Collaborative Partner experience
- Gemini 3.5 Flash agent behavior and prompts
- Google ADK agent and auditable function tools
- Firestore learning-model mutation history
- Pub/Sub asynchronous deep-analysis queue
- Cloud Run deployment configuration and evidence
- Hackathon architecture, reproducibility instructions, evaluation artifacts, and demo

## Claim boundary

The submission will describe the pre-existing app as the product foundation and the newly built autonomous agent system as the contest work. Screenshots, video narration, README language, and Devpost text must follow this boundary.

If the organizers interpret “New Projects Only” more narrowly, this entry will be submitted only after written confirmation from Devpost or the Sponsor that disclosed pre-existing foundations are permitted.

## Current deployment status

As of 2026-08-22, the contest-period Google agent system is live in entrant-owned Google Cloud project `project-0069ddaa-e176-4b98-9db`:

- The Google ADK API server runs on Cloud Run with Gemini 3.5 Flash through Vertex AI.
- Each model mutation writes both a current Firestore document and an immutable version.
- Pub/Sub delivers safe-digest background jobs to a separate private Cloud Run worker using OIDC.
- The public Sites frontend reaches the ADK service only through a same-origin server proxy; the browser never receives the shared Cloud Run credential.
- A judge-safe end-to-end run persisted mutation `9aPqpj5FpIXwgGf89HVQ`, queued Pub/Sub message `21517632790505643`, and completed the corresponding background analysis.
- The full pre-existing retrieval-first learning workspace is available separately as a no-account `/demo` route and remains disclosed as pre-existing work.
