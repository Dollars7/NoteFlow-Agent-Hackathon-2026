import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const appName = "agent";
const windowMs = 60_000;
const maxRequestsPerWindow = 12;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

type AgentRequest = {
  action?: unknown;
  goal?: unknown;
  notes?: unknown;
  clarification?: unknown;
  locale?: unknown;
  continuationToken?: unknown;
  learnerContext?: unknown;
  practice?: unknown;
};

type Continuation = { userId: string; sessionId: string };

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

function cleanChoice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === "string" && choices.includes(value as T) ? value as T : fallback;
}

async function continuationSignature(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Buffer.from(signature).toString("base64url");
}

async function createContinuationToken(userId: string, sessionId: string, secret: string): Promise<string> {
  const payload = `${userId}.${sessionId}`;
  return `${payload}.${await continuationSignature(payload, secret)}`;
}

async function verifyContinuationToken(token: string, secret: string): Promise<Continuation | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, sessionId, suppliedSignature] = parts;
  if (!/^judge-[a-f0-9-]{36}$/i.test(userId) || !/^[a-f0-9-]{36}$/i.test(sessionId)) return null;
  const expected = await continuationSignature(`${userId}.${sessionId}`, secret);
  if (suppliedSignature.length !== expected.length) return null;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ suppliedSignature.charCodeAt(index);
  }
  return mismatch === 0 ? { userId, sessionId } : null;
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
  const requestedLocale = request.headers.get("x-noteflow-locale") === "zh" ? "zh" : "en";
  const message = (english: string, chinese: string) => requestedLocale === "zh" ? chinese : english;

  if (isRateLimited(clientKey(request))) {
    return NextResponse.json(
      { error: message("Please wait a minute before running another live agent session.", "请等待一分钟后再运行新的 Agent 会话。") },
      { status: 429 },
    );
  }

  const agentUrl = process.env.NOTEFLOW_AGENT_URL?.replace(/\/$/, "") ?? "";
  const sharedSecret = process.env.NOTEFLOW_AGENT_SHARED_SECRET ?? "";
  if (!agentUrl || !sharedSecret) {
    return NextResponse.json({ error: message("The cloud agent is not configured.", "云端 Agent 尚未配置。") }, { status: 503 });
  }

  let body: AgentRequest;
  try {
    body = (await request.json()) as AgentRequest;
  } catch {
    return NextResponse.json({ error: message("A JSON request body is required.", "请求必须包含 JSON 数据。") }, { status: 400 });
  }

  const locale = body.locale === "zh" ? "zh" : "en";
  const action = cleanChoice(body.action, ["plan", "clarification", "feedback"] as const, "plan");
  const goal = cleanText(body.goal, 400);
  const notes = cleanText(body.notes, 12_000);
  const clarification = cleanText(body.clarification, 1_000);
  if (action === "plan" && (!goal || !notes)) {
    return NextResponse.json({ error: locale === "zh" ? "请填写学习目标和来源笔记。" : "A learning goal and source notes are required." }, { status: 400 });
  }

  const rawContext = body.learnerContext && typeof body.learnerContext === "object"
    ? body.learnerContext as Record<string, unknown>
    : {};
  const learnerContext = {
    learningPreferences: cleanText(rawContext.learningPreferences, 1_200),
    constraints: cleanText(rawContext.constraints, 1_200),
    studyPattern: cleanChoice(rawContext.studyPattern, ["short-frequent", "fixed-daily", "energy-aligned"] as const, "short-frequent"),
    sessionMinutes: cleanNumber(rawContext.sessionMinutes, 20, 5, 90),
    daysPerWeek: cleanNumber(rawContext.daysPerWeek, 5, 1, 7),
    energyWindow: cleanChoice(rawContext.energyWindow, ["morning", "midday", "evening", "variable"] as const, "evening"),
    preferredTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(cleanText(rawContext.preferredTime, 5))
      ? cleanText(rawContext.preferredTime, 5)
      : "19:00",
    reminderOptIn: rawContext.reminderOptIn === true,
  };

  let userId = `judge-${crypto.randomUUID()}`;
  let sessionId = crypto.randomUUID();
  if (action !== "plan") {
    const continuationToken = cleanText(body.continuationToken, 500);
    const continuation = await verifyContinuationToken(continuationToken, sharedSecret);
    if (!continuation) {
      return NextResponse.json(
        { error: message("This learning session can no longer be continued.", "本次学习会话已无法继续。") },
        { status: 401 },
      );
    }
    userId = continuation.userId;
    sessionId = continuation.sessionId;
  }

  const authorization = `Bearer ${sharedSecret}`;

  try {
    if (action === "plan") {
      const sessionResponse = await fetch(
        `${agentUrl}/apps/${appName}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "POST",
          headers: { authorization, "content-type": "application/json" },
          body: JSON.stringify({ goal, sourceType: "messy_notes", learnerContext }),
        },
      );
      if (!sessionResponse.ok && sessionResponse.status !== 409) {
        throw new Error(`Session creation failed (${sessionResponse.status}).`);
      }
    }

    let prompt: string;
    if (action === "feedback") {
      const rawPractice = body.practice && typeof body.practice === "object"
        ? body.practice as Record<string, unknown>
        : {};
      const practice = {
        cardTitle: cleanText(rawPractice.cardTitle, 300),
        prompt: cleanText(rawPractice.prompt, 2_000),
        attemptOutcome: cleanChoice(rawPractice.attemptOutcome, ["fluent", "stuck"] as const, "stuck"),
        feedback: cleanChoice(rawPractice.feedback, ["guided", "prerequisite", "overlearned"] as const, "guided"),
        hintDepth: cleanNumber(rawPractice.hintDepth, 0, 0, 2),
        reactionMs: cleanNumber(rawPractice.reactionMs, 0, 0, 3_600_000),
        memoryBefore: cleanNumber(rawPractice.memoryBefore, 0, 0, 100),
        memoryAfter: cleanNumber(rawPractice.memoryAfter, 0, 0, 100),
      };
      prompt = [
        `Learner ID: ${userId}`,
        `Response language: ${locale === "zh" ? "Simplified Chinese, including every section heading." : "English."}`,
        "This is real retrieval feedback from the NoteFlow practice flow:",
        JSON.stringify(practice, null, 2),
        "Reassess the learner's sustainable rhythm and knowledge path from this evidence. Call persist_learning_model with the revised rhythm. Explain the before-to-after rhythm change, set the next invitation, and choose exactly one next retrieval prompt.",
      ].join("\n\n");
    } else if (action === "clarification") {
      if (!clarification) {
        return NextResponse.json({ error: message("Please answer the Agent's clarification.", "请回答 Agent 的澄清问题。") }, { status: 400 });
      }
      prompt = [
        `Learner ID: ${userId}`,
        `Response language: ${locale === "zh" ? "Simplified Chinese, including every section heading." : "English."}`,
        `Learner clarification: ${clarification}`,
        "Use this answer to finish the sustainable rhythm, persist it, set one next invitation, and choose exactly one next retrieval prompt.",
      ].join("\n\n");
    } else {
      prompt = [
        `Learner ID: ${userId}`,
        `Response language: ${locale === "zh" ? "Simplified Chinese, including every section heading." : "English."}`,
        `Learning goal: ${goal}`,
        "Learner-controlled context:",
        JSON.stringify(learnerContext, null, 2),
        "Messy source notes:",
        notes,
        "Infer an adjustable plan from this natural-language input before choosing the retrieval. Create planSettings with a continuous steady-to-sprint pace bias, session-duration range, invitation-frequency range, pattern, energy window, optional role baseline, and evidence-grounded themes. These ranges guide invitations, never limit voluntary learning. If essential decision-changing context is still absent, return only one CLARIFICATION question. Otherwise persist the plan, rhythm, and knowledge model; set one next invitation; and give exactly one next retrieval prompt.",
        "Use the requested response language for every user-facing sentence while keeping tool arguments accurate.",
      ].join("\n\n");
    }

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

    return NextResponse.json({
      events: await runResponse.json(),
      runId: sessionId,
      continuationToken: await createContinuationToken(userId, sessionId, sharedSecret),
    });
  } catch (error) {
    console.error("hackathon_agent_proxy_failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The cloud agent could not be reached." },
      { status: 502 },
    );
  }
}
