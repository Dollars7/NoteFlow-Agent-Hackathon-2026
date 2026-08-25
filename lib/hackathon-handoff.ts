import type { Locale } from "../app/locale";

export const hackathonHandoffKey = "noteflow-hackathon-handoff-v1";
export const latestRhythmKey = "noteflow-agent-latest-rhythm-v1";

export type StudyPattern = "short-frequent" | "fixed-daily" | "energy-aligned";
export type EnergyWindow = "morning" | "midday" | "evening" | "variable";

export type LearnerContext = {
  learningPreferences: string;
  constraints: string;
  studyPattern: StudyPattern;
  sessionMinutes: number;
  daysPerWeek: number;
  energyWindow: EnergyWindow;
  preferredTime: string;
  reminderOptIn: boolean;
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
  rationale: string;
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
  nextRetrievalPrompt: string;
  agentReport: string;
  continuationToken?: string;
  learnerContext?: LearnerContext;
  generatedPlan?: GeneratedPlanSettings;
  rhythmPlan?: string;
  nextInvitation?: string;
  createdAt: string;
};

const clampInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
};

const cleanString = (value: unknown, fallback = "") => typeof value === "string" && value.trim()
  ? value.trim()
  : fallback;

export function normalizeGeneratedPlan(
  value: unknown,
  fallback: { goal: string; locale: Locale; learnerContext: LearnerContext },
): GeneratedPlanSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const sessionMin = clampInteger(source.sessionMinutesMin, Math.max(10, fallback.learnerContext.sessionMinutes - 5), 5, 90);
  const sessionMax = Math.max(
    sessionMin,
    clampInteger(source.sessionMinutesMax, fallback.learnerContext.sessionMinutes + 5, 5, 90),
  );
  const invitationMin = clampInteger(
    source.invitationsPerWeekMin,
    Math.max(1, fallback.learnerContext.daysPerWeek - 1),
    1,
    14,
  );
  const invitationMax = Math.max(
    invitationMin,
    clampInteger(source.invitationsPerWeekMax, fallback.learnerContext.daysPerWeek, 1, 14),
  );
  const sourceThemes = Array.isArray(source.themes)
    ? source.themes.map((theme) => cleanString(theme)).filter(Boolean).slice(0, 8)
    : [];
  const sprintLanguage = /interview|exam|deadline|days?|weeks?|面试|考试|截止|天|周/i.test(fallback.goal);

  return {
    goalTitle: cleanString(source.goalTitle, fallback.goal),
    roleBaseline: cleanString(source.roleBaseline),
    themes: sourceThemes.length > 0
      ? sourceThemes
      : fallback.locale === "zh"
        ? ["核心概念", "应用与权衡"]
        : ["Core concepts", "Applied trade-offs"],
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
    preferredTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(source.preferredTime))
      ? String(source.preferredTime)
      : fallback.learnerContext.preferredTime,
    reminderOptIn: typeof source.reminderOptIn === "boolean"
      ? source.reminderOptIn
      : fallback.learnerContext.reminderOptIn,
    rationale: cleanString(
      source.rationale,
      fallback.locale === "zh"
        ? "根据你的目标、学习偏好和现实限制生成；你可以在开始前调整。"
        : "Generated from your goal, learning preferences, and real constraints; adjustable before you begin.",
    ),
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
    candidate.nextRetrievalPrompt &&
    candidate.agentReport,
  );
}
