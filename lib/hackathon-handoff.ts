import type { Locale } from "../app/locale";

export const hackathonHandoffKey = "noteflow-hackathon-handoff-v1";

export type HackathonHandoff = {
  id: string;
  locale: Locale;
  goal: string;
  sourceNotes: string;
  title: string;
  nextRetrievalPrompt: string;
  agentReport: string;
  createdAt: string;
};

export function extractNextRetrieval(report: string, locale: Locale): string {
  const lines = report.split(/\r?\n/).map((line) => line.trim());
  const start = lines.findIndex((line) =>
    /^(?:#{1,6}\s*)?(?:next retrieval|下一次检索)(?:\s*:)?$/i.test(line),
  );

  if (start >= 0) {
    const collected: string[] = [];
    for (const line of lines.slice(start + 1)) {
      if (/^(?:#{1,6}\s*)?(?:model mutation|knowledge model update|background work|模型更新|知识模型更新|后台工作)(?:\s*:)?$/i.test(line)) break;
      if (line) collected.push(line.replace(/^[-*]\s+/, ""));
    }
    if (collected.length > 0) return collected.join(" ");
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
