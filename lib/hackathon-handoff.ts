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
  rhythmPlan?: string;
  nextInvitation?: string;
  createdAt: string;
};

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
    const match = line.match(headingPattern);
    if (match && knownSections.includes(normalizeHeading(match[1]))) break;
    if (line) collected.push(line.replace(/^[-*]\s+/, ""));
  }
  return collected.join("\n").trim();
}

export function extractNextRetrieval(report: string, locale: Locale): string {
  const extracted = extractAgentSection(report, ["next retrieval", "下一次检索"]);
  if (extracted) return extracted.replace(/\s+/g, " ");

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
