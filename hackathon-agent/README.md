# NoteFlow Hackathon Agent

This directory is the newly created Google ADK service for the 2026 All Things Agentic Hackathon. It is intentionally separate from the pre-existing NoteFlow web application.

## Required stack

- Gemini 3.5 Flash through Vertex AI
- Google Agent Development Kit for TypeScript
- Cloud Run for the ADK API server
- Firestore for current and immutable learning-model versions
- Pub/Sub for asynchronous deep-analysis jobs
- A separate authenticated Cloud Run worker that consumes Pub/Sub push events, calls Gemini 3.5 Flash, and writes the completed analysis to Firestore

## Run locally

Prerequisites: Node.js 24.13+, pnpm 11.19+, a Google Cloud project, and Application Default Credentials.

1. Copy `.env.example` to `.env` and replace the Google Cloud project ID.
2. Authenticate locally with Application Default Credentials.
3. Enable Vertex AI, Firestore, Pub/Sub, Cloud Run, Cloud Build, and Artifact Registry APIs.
4. Create a Firestore Native database in the same project.
5. Create the Pub/Sub topic `noteflow-deep-analysis`.
6. Install dependencies with `pnpm --ignore-workspace install`.
7. Start the local ADK API server with `pnpm dev`.
8. Confirm `http://localhost:8000/list-apps` returns `["agent"]`.

The server accepts the standard ADK session and `/run` endpoints. No cloud write is reported as successful unless Firestore or Pub/Sub confirms it.

The background worker can be smoke-tested without invoking Gemini by starting `pnpm worker` and requesting `/healthz`. A real Pub/Sub event requires the Google Cloud variables and Application Default Credentials.

## Deploy to Cloud Run

From this directory, set `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`, then run `pnpm deploy -- --project=$GOOGLE_CLOUD_PROJECT --region=$GOOGLE_CLOUD_LOCATION`.

After deployment:

1. Grant the Cloud Run service identity Firestore user and Pub/Sub publisher roles.
2. Configure allowed origins for the public NoteFlow frontend.
3. Set the frontend variable `NEXT_PUBLIC_NOTEFLOW_AGENT_URL` to the Cloud Run URL.
4. Set `NEXT_PUBLIC_NOTEFLOW_AGENT_APP_NAME=agent` unless the deployed service reports another name from `/list-apps`.
5. Run the demo and verify both a Firestore version document and Pub/Sub message.

Deploy `background-worker.mjs` as a second, authenticated Cloud Run service using `pnpm worker` as its start command. Create a Pub/Sub push subscription for `noteflow-deep-analysis` that targets the worker URL and uses an OIDC service account with Cloud Run Invoker permission. Keep the worker private; Pub/Sub should be its only caller.

Do not commit API keys, service-account JSON files, or `.env`.
