import type { Locale } from "../app/locale";

export const hackathonHandoffKey = "noteflow-hackathon-handoff-v1";
export const latestRhythmKey = "noteflow-agent-latest-rhythm-v1";

export type StudyPattern = "short-frequent" | "fixed-daily" | "energy-aligned";
export type EnergyWindow = "morning" | "midday" | "evening" | "variable";
export type StartMode = "now" | "scheduled" | "undecided";

export type ExplicitPlanningSignals = {
  dailyMinutes: number | null;
  sessionMinutes: number | null;
  daysPerWeek: number | null;
  preferredTime: string;
  startDate: string;
  targetDate: string;
};

export type LearnerContext = {
  learningPreferences: string;
  constraints: string;
  studyPattern: StudyPattern;
  sessionMinutes: number;
  daysPerWeek: number;
  energyWindow: EnergyWindow;
  preferredTime: string;
  reminderOptIn: boolean;
  dailyMinutes: number | null;
  startMode: StartMode;
  startDate: string;
  targetDate: string;
  timeZone: string;
  explicitPlanningSignals: ExplicitPlanningSignals;
};

export type GeneratedPlanSettings = {
  goalTitle: string;
  roleBaseline: string;
  themes: string[];
  paceBias: number;
  sessionMinutesMin: number;
  sessionMinutesMax: number;
  invitationsPerWeekMin: number;
  invitationsPerWeekMax: number;
  studyPattern: StudyPattern;
  energyWindow: EnergyWindow;
  preferredTime: string;
  reminderOptIn: boolean;
  dailyMinutes: number | null;
  startMode: StartMode;
  startDate: string;
  targetDate: string;
  timeZone: string;
  rationale: string;
  retrievalCards: RetrievalCard[];
};

export type RetrievalCard = {
  theme: string;
  mode: "recall" | "speak" | "solve" | "design";
  prompt: string;
  hintKeywords: string[];
  expectedAnswer: string;
  noteMarkdown: string;
  languageCode?: string;
};

export type LearningProject = {
  id: string;
  goal: string;
  sourceNotes: string;
  learningPreferences: string;
  constraints: string;
  themes: string[];
  knowledgeAreas: Array<{ id: string; name: string }>;
  schedule: {
    startMode: StartMode;
    startDate: string;
    startTime: string;
    targetDate: string;
    timeZone: string;
    dailyMinutes: number | null;
    sessionMinutesMin: number;
    sessionMinutesMax: number;
    invitationsPerWeekMin: number;
    invitationsPerWeekMax: number;
  };
};

export type RhythmRevision = {
  before: string;
  after: string;
  nextInvitation: string;
  agentReport: string;
  updatedAt: string;
};

export type HackathonHandoff = {
  id: string;
  locale: Locale;
  goal: string;
  sourceNotes: string;
  title: string;
  retrievalCards: RetrievalCard[];
  agentReport: string;
  continuationToken?: string;
  learnerContext?: LearnerContext;
  generatedPlan?: GeneratedPlanSettings;
  rhythmPlan?: string;
  nextInvitation?: string;
  project?: LearningProject;
  createdAt: string;
};

const clampInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
};

const cleanString = (value: unknown, fallback = "") => typeof value === "string" && value.trim()
  ? value.trim()
  : fallback;

function normalizeRetrievalCards(value: unknown, themes: string[]): RetrievalCard[] {
  if (!Array.isArray(value)) return [];
  const exactThemes = new Map(themes.map((theme) => [theme.trim().toLocaleLowerCase(), theme.trim()]));
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const theme = exactThemes.get(cleanString(source.theme).toLocaleLowerCase());
    const mode = cleanString(source.mode);
    const prompt = cleanString(source.prompt);
    const expectedAnswer = cleanString(source.expectedAnswer);
    const noteMarkdown = cleanString(source.noteMarkdown);
    if (!theme || !["recall", "speak", "solve", "design"].includes(mode) || !prompt || !expectedAnswer || !noteMarkdown) return [];
    const hintKeywords = Array.isArray(source.hintKeywords)
      ? source.hintKeywords.map((keyword) => cleanString(keyword)).filter(Boolean).slice(0, 4)
      : [];
    const languageCode = cleanString(source.languageCode);
    return [{
      theme,
      mode: mode as RetrievalCard["mode"],
      prompt,
      hintKeywords,
      expectedAnswer,
      noteMarkdown,
      ...(languageCode ? { languageCode } : {}),
    }];
  }).slice(0, 8);
}

const minutesFromMatch = (amount: string, unit: string) => {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * (/小时|小時|hours?|hrs?/i.test(unit) ? 60 : 1));
};

export function extractExplicitPlanningSignals(...sources: string[]): ExplicitPlanningSignals {
  const text = sources.filter(Boolean).join("\n");
  const daily = text.match(/(?:每天|每日|一天)[^\d]{0,10}(\d+(?:\.\d+)?)\s*(个)?\s*(小时|小時|分钟|分鐘)/i)
    ?? text.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\s*(?:a|per|each)\s*day/i);
  const session = text.match(/(?:每次|单次|單次|一次)[^\d]{0,10}(\d+(?:\.\d+)?)\s*(个)?\s*(小时|小時|分钟|分鐘)/i)
    ?? text.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\s*(?:a|per|each)\s*session/i);
  const weekly = text.match(/(?:每周|每週|一周|一週)[^\d]{0,10}(\d+)\s*(?:天|次)/i)
    ?? text.match(/(\d+)\s*(?:days?|times?)\s*(?:a|per|each)\s*week/i);
  const clock = text.match(/(?:^|\s|在|从|從|at)([01]?\d|2[0-3]):([0-5]\d)(?:\s|$|开始|開始)/i);
  const startDate = text.match(/(?:开始|開始|start(?:ing)?)(?:日期|时间|時間|date|time)?[^\d]{0,12}(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])/i);
  const targetDate = text.match(/(?:考试|考試|交付|截止|目标|目標|exam|deliver|deadline|due)[^\d]{0,16}(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])/i);
  const normalizeDate = (match: RegExpMatchArray | null) => match
    ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
    : "";

  return {
    dailyMinutes: daily ? minutesFromMatch(daily[1], daily[daily.length - 1]) : null,
    sessionMinutes: session ? minutesFromMatch(session[1], session[session.length - 1]) : null,
    daysPerWeek: weekly ? clampInteger(weekly[1], 0, 1, 7) : null,
    preferredTime: clock ? `${clock[1].padStart(2, "0")}:${clock[2]}` : "",
    startDate: normalizeDate(startDate),
    targetDate: normalizeDate(targetDate),
  };
}

export function projectKnowledgeAreas(themes: string[]): Array<{ id: string; name: string }> {
  const seen = new Set<string>();
  return themes.slice(0, 8).map((name, index) => {
    const normalized = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\u3400-\u9fff]+/g, "-").replace(/^-|-$/g, "");
    let id = normalized || `area-${index + 1}`;
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    return { id, name };
  });
}

export function createRetrievalTitle(prompt: string, themes: string[], locale: Locale): string {
  const theme = themes.find((value) => value.trim())?.trim();
  if (theme) return locale === "zh" ? `${theme} · 主动检索` : `${theme} · Active retrieval`;
  const sentence = prompt.replace(/\s+/g, " ").trim().split(/[。！？.!?]/)[0]?.slice(0, 46);
  return sentence || (locale === "zh" ? "第一次主动检索" : "First active retrieval");
}

export function normalizeGeneratedPlan(
  value: unknown,
  fallback: { goal: string; locale: Locale; learnerContext: LearnerContext },
): GeneratedPlanSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const explicit = fallback.learnerContext.explicitPlanningSignals;
  const explicitSession = explicit.sessionMinutes;
  const sessionMin = explicitSession ?? clampInteger(source.sessionMinutesMin, Math.max(10, fallback.learnerContext.sessionMinutes - 5), 5, 90);
  const sessionMax = Math.max(
    sessionMin,
    explicitSession ?? clampInteger(source.sessionMinutesMax, fallback.learnerContext.sessionMinutes + 5, 5, 90),
  );
  const invitationMin = clampInteger(
    explicit.daysPerWeek ?? source.invitationsPerWeekMin,
    Math.max(1, fallback.learnerContext.daysPerWeek - 1),
    1,
    14,
  );
  const invitationMax = Math.max(
    invitationMin,
    clampInteger(explicit.daysPerWeek ?? source.invitationsPerWeekMax, fallback.learnerContext.daysPerWeek, 1, 14),
  );
  const sourceThemes = Array.isArray(source.themes)
    ? source.themes.map((theme) => cleanString(theme)).filter(Boolean).slice(0, 8)
    : [];
  const themes = sourceThemes.length > 0
    ? sourceThemes
    : fallback.locale === "zh"
      ? ["核心概念", "应用与权衡"]
      : ["Core concepts", "Applied trade-offs"];
  const sprintLanguage = /interview|exam|deadline|days?|weeks?|面试|考试|截止|天|周/i.test(fallback.goal);
  const startMode = fallback.learnerContext.startMode !== "undecided"
    ? fallback.learnerContext.startMode
    : ["now", "scheduled", "undecided"].includes(String(source.startMode))
      ? source.startMode as StartMode
      : fallback.learnerContext.startMode;
  const startDateValue = cleanString(explicit.startDate || source.startDate, fallback.learnerContext.startDate);
  const reminderRequested = typeof source.reminderOptIn === "boolean"
    ? source.reminderOptIn
    : fallback.learnerContext.reminderOptIn;
  const scheduleConfirmed = startMode === "now" || (startMode === "scheduled" && Boolean(startDateValue));

  return {
    goalTitle: cleanString(source.goalTitle, fallback.goal),
    roleBaseline: cleanString(source.roleBaseline),
    themes,
    paceBias: clampInteger(source.paceBias, sprintLanguage ? 72 : 32, 0, 100),
    sessionMinutesMin: sessionMin,
    sessionMinutesMax: sessionMax,
    invitationsPerWeekMin: invitationMin,
    invitationsPerWeekMax: invitationMax,
    studyPattern: ["short-frequent", "fixed-daily", "energy-aligned"].includes(String(source.studyPattern))
      ? source.studyPattern as StudyPattern
      : fallback.learnerContext.studyPattern,
    energyWindow: ["morning", "midday", "evening", "variable"].includes(String(source.energyWindow))
      ? source.energyWindow as EnergyWindow
      : fallback.learnerContext.energyWindow,
    preferredTime: explicit.preferredTime || (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(source.preferredTime))
      ? String(source.preferredTime)
      : fallback.learnerContext.preferredTime),
    reminderOptIn: scheduleConfirmed && reminderRequested,
    dailyMinutes: explicit.dailyMinutes
      ?? (source.dailyMinutes === null ? null : clampInteger(source.dailyMinutes, fallback.learnerContext.dailyMinutes ?? 0, 5, 720) || null),
    startMode,
    startDate: startDateValue,
    targetDate: cleanString(explicit.targetDate || source.targetDate, fallback.learnerContext.targetDate),
    timeZone: cleanString(source.timeZone, fallback.learnerContext.timeZone),
    rationale: cleanString(
      source.rationale,
      fallback.locale === "zh"
        ? "根据你的目标、学习偏好和现实限制生成；你可以在开始前调整。"
        : "Generated from your goal, learning preferences, and real constraints; adjustable before you begin.",
    ),
    retrievalCards: normalizeRetrievalCards(source.retrievalCards, themes),
  };
}

export function extractGeneratedPlan(
  events: unknown,
  fallback: { goal: string; locale: Locale; learnerContext: LearnerContext },
): GeneratedPlanSettings {
  if (Array.isArray(events)) {
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
        let args = call.args ?? call.arguments;
        if (typeof args === "string") {
          try { args = JSON.parse(args) as unknown; } catch { args = null; }
        }
        if (args && typeof args === "object") {
          const plan = (args as { planSettings?: unknown }).planSettings;
          if (plan) return normalizeGeneratedPlan(plan, fallback);
        }
      }
    }
  }
  return normalizeGeneratedPlan(null, fallback);
}

export function extractAgentText(events: unknown, fallback: string): string {
  if (!Array.isArray(events)) return fallback;

  for (const event of [...events].reverse()) {
    if (!event || typeof event !== "object") continue;
    const content = (event as { content?: { parts?: unknown[] } }).content;
    if (!Array.isArray(content?.parts)) continue;
    for (const part of content.parts) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }

  return fallback;
}

export function extractAgentSection(report: string, headings: string[]): string {
  const lines = report.split(/\r?\n/);
  const normalizedHeadings = headings.map((heading) => heading.toLowerCase());
  const headingPattern = /^(?:#{1,6}\s*)?([^:]+?)(?:\s*:)?$/;
  const normalizeHeading = (heading: string) => heading.trim().replace(/^[*_`]+|[*_`]+$/g, "").toLowerCase();
  const start = lines.findIndex((line) => {
    const match = line.trim().match(headingPattern);
    return Boolean(match && normalizedHeadings.includes(normalizeHeading(match[1])));
  });
  if (start < 0) return "";

  const knownSections = [
    "diagnosis", "rhythm plan", "next invitation", "next retrieval", "model mutation",
    "knowledge model update", "background work", "clarification",
    "诊断", "学习节奏", "下次邀请", "下一次检索", "模型更新", "知识模型更新", "后台工作", "澄清问题",
  ];
  const collected: string[] = [];
  for (const rawLine of lines.slice(start + 1)) {
    const line = rawLine.trim();
    if (/^---+$/.test(line)) {
      if (collected.length) break;
      continue;
    }
    const match = line.match(headingPattern);
    if (match && knownSections.includes(normalizeHeading(match[1]))) break;
    if (line) collected.push(line.replace(/^[-*]\s+/, ""));
  }
  return collected.join("\n").trim();
}

export function extractNextRetrieval(report: string, locale: Locale): string {
  const extracted = extractAgentSection(report, ["next retrieval", "下一次检索"]);
  if (extracted) {
    return extracted
      .replace(/^\s*(?:>\s*|(?:[-+*]|\d+\.)\s+)/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  return locale === "zh"
    ? "不看笔记，用自己的话说明最重要的概念、权衡以及你会采取的下一步。"
    : "Without looking at the notes, explain the most important concept, tradeoff, and next decision in your own words.";
}

export function isHackathonHandoff(value: unknown): value is HackathonHandoff {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HackathonHandoff>;
  return Boolean(
    candidate.id &&
    (candidate.locale === "en" || candidate.locale === "zh") &&
    candidate.goal &&
    Array.isArray(candidate.retrievalCards) &&
    candidate.retrievalCards.length > 0 &&
    candidate.agentReport,
  );
}
