# Deployment and clean-machine reproduction

The public web experience and the protected Agent backend deploy separately.

## Web experience · Vercel

Import only the repository root, `NoteFlow-Agent-Hackathon-2026`, as the Vercel project. Do not import `hackathon-agent` as a second Vercel website; that directory is the Google ADK backend and belongs on Cloud Run.

Configure these values as server-only variables on the root Vercel project:

```text
NOTEFLOW_AGENT_URL
NOTEFLOW_AGENT_SHARED_SECRET
```

Never add a `NEXT_PUBLIC_` prefix. Verify the root page, `/api/hackathon-agent`, one live Agent run, plan review, and the handoff to `/demo` before treating a deployment as complete.

## Google Agent · Cloud Run

The `hackathon-agent` directory contains the interactive Google ADK service, its protected HTTP entry point, and the separate private Pub/Sub worker. Follow [the Agent service README](../hackathon-agent/README.md) for local setup and Cloud Run requirements.

## Clean-machine check

Use Node.js 24.13+ for both the root app and Agent service.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm exec tsc --noEmit

cd hackathon-agent
pnpm install --frozen-lockfile
pnpm test
pnpm dev
```

With Application Default Credentials and the Google project variables configured, `http://localhost:8000/list-apps` must return `["agent"]`. Local `pnpm dev` does not require `NOTEFLOW_AGENT_SHARED_SECRET`; the Cloud Run entry point `node server.mjs` does.
