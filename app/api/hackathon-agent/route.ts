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

type PersistCallState = {
  found: boolean;
  retrievalCardCount: number;
};

const millisecondsPerDay = 86_400_000;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

function cleanNullableNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : null;
}

function cleanChoice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === "string" && choices.includes(value as T) ? value as T : fallback;
}

function safeTimeZone(value: string): string {
  const candidate = value || "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
}

function calendarDateInTimeZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function temporalContext(targetDate: string, requestedTimeZone: string): string {
  const timeZone = safeTimeZone(requestedTimeZone);
  const today = calendarDateInTimeZone(timeZone);
  if (!targetDate) return `Today is ${today} in the learner's time zone (${timeZone}).`;

  const daysUntil = Math.round((Date.parse(targetDate) - Date.parse(today)) / millisecondsPerDay);
  const distance = daysUntil > 0
    ? `${daysUntil} calendar days from today`
    : daysUntil === 0
      ? "today"
      : `${Math.abs(daysUntil)} calendar days ago; the target date has passed`;
  return `Today is ${today} in the learner's time zone (${timeZone}). The target date is ${targetDate}, ${distance}. Use this server-computed distance exactly; do not recalculate or infer the current date.`;
}

function parseFunctionArguments(value: unknown): Record<string, unknown> | null {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return null;
    }
  }
  return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
}

function inspectPersistCall(events: unknown): PersistCallState {
  if (!Array.isArray(events)) return { found: false, retrievalCardCount: 0 };
  let found = false;
  let retrievalCardCount = 0;
  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const parts = (event as { content?: { parts?: unknown[] } }).content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      const candidate = part as {
        functionCall?: { name?: unknown; args?: unknown; arguments?: unknown };
        function_call?: { name?: unknown; args?: unknown; arguments?: unknown };
      };
      const call = candidate.functionCall ?? candidate.function_call;
      if (call?.name !== "persist_learning_model") continue;
      found = true;
      const args = parseFunctionArguments(call.args ?? call.arguments);
      const planSettings = args?.planSettings;
      const retrievalCards = planSettings && typeof planSettings === "object"
        ? (planSettings as { retrievalCards?: unknown }).retrievalCards
        : null;
      retrievalCardCount = Math.max(retrievalCardCount, Array.isArray(retrievalCards) ? retrievalCards.length : 0);
    }
  }
  return { found, retrievalCardCount };
}

function responseText(events: unknown): string {
  if (!Array.isArray(events)) return "";
  return events.flatMap((event) => {
    if (!event || typeof event !== "object") return [];
    const parts = (event as { content?: { parts?: unknown[] } }).content?.parts;
    if (!Array.isArray(parts)) return [];
    return parts.flatMap((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
      ? [(part as { text: string }).text]
      : []);
  }).join("\n");
}

function isClarificationResponse(events: unknown): boolean {
  return /(?:^|\n)\s*(?:#{1,6}\s*)?(?:CLARIFICATION|澄清问题)\s*:?(?:\n|$)/i.test(responseText(events));
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
  const responseLanguage = locale === "zh"
    ? "Response language: Simplified Chinese only. Do not add English translations or bilingual headings; use English only for unavoidable technical proper nouns and identifiers."
    : "Response language: English only. Do not use Chinese words, translations, or bilingual headings.";
  const action = cleanChoice(body.action, ["plan", "clarification", "feedback"] as const, "plan");
  const goal = cleanText(body.goal, 400);
  const notes = cleanText(body.notes, 12_000);
  const clarification = cleanText(body.clarification, 1_000);
  if (action === "plan" && (!goal || !notes)) {
    return NextResponse.json({ error: locale === "zh" ? "请填写学习目标，并至少写下一条学习材料或卡点。" : "Add a learning goal and at least one note or stuck point." }, { status: 400 });
  }

  const rawContext = body.learnerContext && typeof body.learnerContext === "object"
    ? body.learnerContext as Record<string, unknown>
    : {};
  const rawSignals = rawContext.explicitPlanningSignals && typeof rawContext.explicitPlanningSignals === "object"
    ? rawContext.explicitPlanningSignals as Record<string, unknown>
    : {};
  const explicitPlanningSignals = {
    dailyMinutes: cleanNullableNumber(rawSignals.dailyMinutes, 5, 720),
    sessionMinutes: cleanNullableNumber(rawSignals.sessionMinutes, 5, 180),
    daysPerWeek: cleanNullableNumber(rawSignals.daysPerWeek, 1, 7),
    preferredTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(cleanText(rawSignals.preferredTime, 5))
      ? cleanText(rawSignals.preferredTime, 5)
      : "",
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(cleanText(rawSignals.startDate, 10))
      ? cleanText(rawSignals.startDate, 10)
      : "",
    targetDate: /^\d{4}-\d{2}-\d{2}$/.test(cleanText(rawSignals.targetDate, 10))
      ? cleanText(rawSignals.targetDate, 10)
      : "",
  };
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
    dailyMinutes: cleanNullableNumber(rawContext.dailyMinutes, 5, 720),
    startMode: cleanChoice(rawContext.startMode, ["now", "scheduled", "undecided"] as const, "undecided"),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(cleanText(rawContext.startDate, 10)) ? cleanText(rawContext.startDate, 10) : "",
    targetDate: /^\d{4}-\d{2}-\d{2}$/.test(cleanText(rawContext.targetDate, 10)) ? cleanText(rawContext.targetDate, 10) : "",
    timeZone: cleanText(rawContext.timeZone, 80),
    explicitPlanningSignals,
  };
  const effectiveTargetDate = explicitPlanningSignals.targetDate || learnerContext.targetDate;
  const currentDateContext = temporalContext(effectiveTargetDate, learnerContext.timeZone);

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
        currentDateContext,
        responseLanguage,
        "This is real retrieval feedback from the NoteFlow practice flow:",
        JSON.stringify(practice, null, 2),
        "Reassess the learner's sustainable rhythm and knowledge path from this evidence. Call persist_learning_model with the revised rhythm. Explain the before-to-after rhythm change, set the next invitation, and return 3–8 structured retrievalCards in planSettings. Every card.theme must exactly match a plan theme so NoteFlow can update the correct skill.",
      ].join("\n\n");
    } else if (action === "clarification") {
      if (!clarification) {
        return NextResponse.json({ error: message("Please answer the Agent's clarification.", "请回答 Agent 的澄清问题。") }, { status: 400 });
      }
      prompt = [
        `Learner ID: ${userId}`,
        currentDateContext,
        responseLanguage,
        `Learner clarification: ${clarification}`,
        "Updated merged learner context:",
        JSON.stringify(learnerContext, null, 2),
        "Treat this answer and the updated context as part of the same instruction. Explicit numeric, date, and time statements override earlier defaults. Keep daily total time separate from per-session length. Use this answer to finish the sustainable rhythm, persist it, set one next invitation, and return 3–8 structured retrievalCards in planSettings. Every card.theme must exactly match a plan theme so NoteFlow can update the correct skill.",
      ].join("\n\n");
    } else {
      prompt = [
        `Learner ID: ${userId}`,
        currentDateContext,
        responseLanguage,
        `Learning goal: ${goal}`,
        "Learner-controlled context:",
        JSON.stringify(learnerContext, null, 2),
        "Messy source notes:",
        notes,
        "Treat the goal, notes, learning preferences, constraints, and explicitPlanningSignals as one merged instruction. Explicit numeric, date, and time statements always override defaults. Preserve the distinction between daily total time and per-session length; for example, “one hour a day” means dailyMinutes=60 and does not by itself require a 60-minute session. If two explicit statements conflict and the choice changes the plan, ask one clarification.",
        "Infer an adjustable plan before choosing retrievals. Create planSettings with a continuous steady-to-sprint pace bias, session-duration range, invitation-frequency range, daily time budget, start mode/date/time, target date, time zone, optional role baseline, evidence-grounded themes, and 3–8 structured retrievalCards. Every card.theme must exactly match one plan theme; its prompt must require an attempt rather than name a topic. For language goals default to speak mode, include languageCode, and place a target-language example plus its meaning in noteMarkdown. These ranges guide invitations, never limit voluntary learning. Never create or imply a scheduled reminder while startMode is undecided. If essential decision-changing context is still absent, return only one CLARIFICATION question. Otherwise persist the plan, rhythm, and knowledge model and set one next invitation.",
        "You MUST call persist_learning_model with 3–8 complete retrievalCards before writing the report; a report without this tool call is a failed turn. Use the requested response language for every user-facing sentence while keeping tool arguments accurate. Keep the report concise; the structured tool call is the detailed source of truth.",
      ].join("\n\n");
    }

    const runAgent = (messageText: string) => fetch(`${agentUrl}/run`, {
      method: "POST",
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify({
        appName,
        userId,
        sessionId,
        newMessage: { role: "user", parts: [{ text: messageText }] },
      }),
    });
    const runResponse = await runAgent(prompt);
    if (!runResponse.ok) throw new Error(`Agent run failed (${runResponse.status}).`);

    let events = await runResponse.json() as unknown;
    const firstPersistCall = inspectPersistCall(events);
    if (!isClarificationResponse(events) && (!firstPersistCall.found || firstPersistCall.retrievalCardCount < 3)) {
      const correctionPrompt = [
        currentDateContext,
        responseLanguage,
        "Your previous turn was incomplete and must be corrected. You MUST call persist_learning_model before writing any report; a report without that tool call is a failed turn.",
        "The tool arguments MUST include planSettings.retrievalCards with 3–8 complete cards. Every card.theme must exactly match one planSettings.themes value. Do not put card prompts only in report prose.",
        "After the successful tool call, return the six concise report sections.",
      ].join("\n\n");
      const correctionResponse = await runAgent(correctionPrompt);
      if (!correctionResponse.ok) throw new Error(`Agent correction failed (${correctionResponse.status}).`);
      events = await correctionResponse.json() as unknown;
      const correctedPersistCall = inspectPersistCall(events);
      if (!correctedPersistCall.found || correctedPersistCall.retrievalCardCount < 3) {
        throw new Error(message(
          "The Agent did not return the required structured retrieval cards.",
          "Agent 没有返回必需的结构化检索卡片。",
        ));
      }
    }

    return NextResponse.json({
      events,
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
