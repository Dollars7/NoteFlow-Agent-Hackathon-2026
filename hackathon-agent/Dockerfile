FROM node:24-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

RUN mkdir -p /app/agents/agent
COPY agent.ts /app/agents/agent/agent.ts
COPY background-worker.mjs server.mjs ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.mjs"]
