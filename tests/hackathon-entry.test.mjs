import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("declares the mandatory Google agent stack and honest preview behavior", async () => {
  const [agent, worker, server, agentPackageText, demo, proxy, disclosure, architecture, envExample] = await Promise.all([
    readFile(new URL("../hackathon-agent/agent.ts", import.meta.url), "utf8"),
    readFile(new URL("../hackathon-agent/background-worker.mjs", import.meta.url), "utf8"),
    readFile(new URL("../hackathon-agent/server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../hackathon-agent/package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/hackathon/hackathon-demo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/hackathon-agent/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../HACKATHON_DISCLOSURE.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/HACKATHON_ARCHITECTURE.md", import.meta.url), "utf8"),
    readFile(new URL("../hackathon-agent/.env.example", import.meta.url), "utf8"),
  ]);

  const agentPackage = JSON.parse(agentPackageText);
  assert.equal(agentPackage.dependencies["@google/adk"], "1.6.0");
  assert.equal(agentPackage.dependencies["@google-cloud/firestore"], "9.0.0");
  assert.equal(agentPackage.dependencies["@google-cloud/pubsub"], "6.0.1");
  assert.equal(agentPackage.dependencies["@google/genai"], "2.17.1");

  assert.match(agent, /modelName = 'gemini-3\.5-flash'/);
  assert.match(agent, /new LlmAgent/);
  assert.match(agent, /name: 'persist_learning_model'/);
  assert.match(agent, /batch\.create\(versionRef, payload\)/);
  assert.match(agent, /name: 'queue_deep_analysis'/);
  assert.match(agent, /publishMessage\(\{json: job\}\)/);
  assert.match(agent, /learnerContextSchema/);
  assert.match(agent, /rhythmPlanSchema/);
  assert.match(agent, /planSettingsSchema/);
  assert.match(agent, /paceBias/);
  assert.match(agent, /NEXT INVITATION/);
  assert.match(agent, /no persistence was claimed/i);
  assert.match(agent, /no background job was claimed/i);
  assert.match(worker, /new GoogleGenAI\(\{vertexai: true, project, location\}\)/);
  assert.match(worker, /model = 'gemini-3\.5-flash'/);
  assert.match(worker, /backgroundAnalyses/);
  assert.match(worker, /request\.url === '\/healthz'/);
  assert.match(server, /new AdkApiServer/);
  assert.match(server, /NOTEFLOW_AGENT_SHARED_SECRET/);

  assert.match(demo, /Transparent local preview/);
  assert.match(demo, /never presents sample output as Gemini output|labeled sample output/i);
  assert.match(demo, /\/api\/hackathon-agent/);
  assert.match(proxy, /NOTEFLOW_AGENT_URL/);
  assert.match(proxy, /NOTEFLOW_AGENT_SHARED_SECRET/);
  assert.match(disclosure, /c42c840c2d881207ed6763a3280d198bc1189bfc/);
  assert.match(disclosure, /Pre-existing NoteFlow components/);
  assert.match(disclosure, /Newly created hackathon scope/);
  assert.match(architecture, /Cloud Run/);
  assert.match(architecture, /Firestore/);
  assert.match(architecture, /Pub\/Sub/);
  assert.doesNotMatch(envExample, /AIza[0-9A-Za-z_-]{30,}/);
  assert.doesNotMatch(envExample, /BEGIN PRIVATE KEY/);
});

test("serves a public, self-identifying hackathon experience", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("hackathon-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/hackathon", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>NoteFlow Agent — All Things Agentic<\/title>/);
  assert.match(html, /Collaborative Partner · 2026 entry/);
  assert.match(html, /Transparent local preview/);
  assert.match(html, /hackathon-og\.png/);
  assert.match(html, /Try the learning workspace/);
});

test("serves the complete learning workspace without requiring an account", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("guest-workspace-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/demo", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Guest demo · saved in this browser/);
  assert.match(html, /Start this session/);
  assert.match(html, /Notes/);
});
