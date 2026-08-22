import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const appName = "agent";
const windowMs = 60_000;
const maxRequestsPerWindow = 6;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

type AgentRequest = {
  goal?: unknown;
  notes?: unknown;
  clarification?: unknown;
};

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function clientKey(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous"
  );
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  current.count += 1;
  return current.count > maxRequestsPerWindow;
}

export async function POST(request: NextRequest) {
  if (isRateLimited(clientKey(request))) {
    return NextResponse.json(
      { error: "Please wait a minute before running another live agent session." },
      { status: 429 },
    );
  }

  const agentUrl = process.env.NOTEFLOW_AGENT_URL?.replace(/\/$/, "") ?? "";
  const sharedSecret = process.env.NOTEFLOW_AGENT_SHARED_SECRET ?? "";
  if (!agentUrl || !sharedSecret) {
    return NextResponse.json({ error: "The cloud agent is not configured." }, { status: 503 });
  }

  let body: AgentRequest;
  try {
    body = (await request.json()) as AgentRequest;
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const goal = cleanText(body.goal, 400);
  const notes = cleanText(body.notes, 12_000);
  const clarification = cleanText(body.clarification, 1_000);
  if (!goal || !notes) {
    return NextResponse.json({ error: "A learning goal and source notes are required." }, { status: 400 });
  }

  const userId = `judge-${crypto.randomUUID()}`;
  const sessionId = crypto.randomUUID();
  const authorization = `Bearer ${sharedSecret}`;

  try {
    const sessionResponse = await fetch(
      `${agentUrl}/apps/${appName}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: JSON.stringify({ goal, sourceType: "messy_notes" }),
      },
    );
    if (!sessionResponse.ok && sessionResponse.status !== 409) {
      throw new Error(`Session creation failed (${sessionResponse.status}).`);
    }

    const prompt = [
      `Learner ID: ${userId}`,
      `Learning goal: ${goal}`,
      `Learner clarification: ${clarification || "No additional context provided."}`,
      "Messy source notes:",
      notes,
      "Lead the learner. Diagnose the knowledge structure, mutate the learning model with your tools, and give exactly one next retrieval prompt.",
    ].join("\n\n");

    const runResponse = await fetch(`${agentUrl}/run`, {
      method: "POST",
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify({
        appName,
        userId,
        sessionId,
        newMessage: { role: "user", parts: [{ text: prompt }] },
      }),
    });
    if (!runResponse.ok) throw new Error(`Agent run failed (${runResponse.status}).`);

    return NextResponse.json({ events: await runResponse.json(), runId: sessionId });
  } catch (error) {
    console.error("hackathon_agent_proxy_failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The cloud agent could not be reached." },
      { status: 502 },
    );
  }
}
