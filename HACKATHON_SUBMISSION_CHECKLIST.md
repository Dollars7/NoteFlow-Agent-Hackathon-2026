# All Things Agentic submission checklist

This checklist separates completed repository work from actions that require the entrant’s Google Cloud and Devpost accounts.

## Completed on 2026-08-18

- [x] Preserve the pre-existing NoteFlow history and baseline hash
- [x] Create a separate hackathon branch
- [x] Add a default-English Collaborative Partner experience with an in-place Chinese translation
- [x] Implement Gemini 3.5 Flash with Google ADK
- [x] Implement Firestore model mutations and immutable versions
- [x] Implement Pub/Sub background jobs and a Cloud Run worker entry point
- [x] Add an architecture diagram and reproducible setup instructions
- [x] Add transparent offline-preview labeling
- [x] Add route-specific social metadata and image
- [x] Pass local build, type, route, framework, worker-health, and automated tests

## Requires entrant account access

- [ ] Ask Devpost to confirm the disclosed pre-existing-foundation interpretation
- [x] Create or select a Google Cloud billing project
- [x] Enable Vertex AI, Cloud Run, Firestore, Pub/Sub, Cloud Build, and Artifact Registry
- [x] Create the Firestore database and `noteflow-deep-analysis` topic
- [x] Deploy the ADK service and private background worker to Cloud Run
- [x] Create the authenticated Pub/Sub push subscription
- [x] Apply least-privilege service-account roles
- [x] Configure the deployed frontend with the Cloud Run agent URL and server-only credential
- [x] Capture Cloud Run, Vertex AI, Firestore, and Pub/Sub proof identifiers for the demo video
- [x] Run an end-to-end test using judge-safe sample data
- [ ] Push the contest branch to `Dollars7/NoteFlow`, then publish the repository or grant the required judge accounts access
- [ ] Record an English demo of no more than four minutes
- [ ] Complete the Devpost description, technology list, data-source disclosure, findings, and testing instructions
- [ ] Submit before 2026-08-31 5:00 PM Pacific Time

Do not mark cloud or submission items complete until the corresponding external system confirms success.
