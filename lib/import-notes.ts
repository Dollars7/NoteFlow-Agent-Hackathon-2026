import type { NoteCard, RetrievalMode, SkillState } from "./flow-engine";

export type NoteImportResult = {
  cards: NoteCard[];
  warnings: string[];
  format: "noteflow-csv" | "anki";
};

const normalizedHeader = (value: string) =>
  value.trim().toLowerCase().replace(/[\s_-]+/g, "");

const headerAliases = {
  title: ["title", "name", "标题"],
  prompt: ["prompt", "front", "question", "正面", "问题"],
  noteMarkdown: ["notemarkdown", "note", "back", "answer", "背面", "答案", "markdown"],
  skill: ["skill", "skillid", "category", "deck", "领域", "分类", "牌组"],
  tags: ["tags", "tag", "标签"],
  mode: ["mode", "type", "模式", "cardtype"],
  hintKeywords: ["hintkeywords", "hints", "keywords", "提示", "关键词"],
  scaffold: ["scaffold", "outline", "骨架"],
} as const;

function parseRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function findColumn(headers: string[], aliases: readonly string[]) {
  return headers.findIndex((header) => aliases.includes(normalizedHeader(header)));
}

function cleanAnkiHtml(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .trim();
}

function splitList(value: string) {
  return [...new Set(value.split(/[|;,]+|\s+/).map((item) => item.trim()).filter(Boolean))];
}

function resolveSkill(
  rawSkill: string,
  tags: string[],
  skills: SkillState[],
  fallbackSkillId: string,
) {
  const candidates = [rawSkill, ...tags].map(normalizedHeader);
  const match = skills.find((skill) =>
    candidates.some((candidate) =>
      candidate === normalizedHeader(skill.id) ||
      candidate === normalizedHeader(skill.name) ||
      candidate.includes(normalizedHeader(skill.id)),
    ),
  );
  return match?.id ?? fallbackSkillId;
}

function allowedMode(value: string): RetrievalMode {
  return ["recall", "solve", "speak", "design"].includes(value.toLowerCase())
    ? (value.toLowerCase() as RetrievalMode)
    : "recall";
}

export function parseNoteImport(
  source: string,
  skills: SkillState[],
  fallbackSkillId: string,
  idPrefix = `import-${Date.now()}`,
  locale: "en" | "zh" = "en",
): NoteImportResult {
  const t = (english: string, chinese: string) => locale === "zh" ? chinese : english;
  const text = source.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const rows = parseRows(text, delimiter);
  if (rows.length === 0) return { cards: [], warnings: [t("The file has no importable content.", "文件中没有可导入的内容。")], format: "noteflow-csv" };

  const firstHeaders = rows[0].map(normalizedHeader);
  const knownHeaders: string[] = Object.values(headerAliases).flat();
  const hasHeader = firstHeaders.some((header) => knownHeaders.includes(header));
  const headers = hasHeader ? rows[0] : ["front", "back", "tags"];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const format =
    headers.some((header) => ["front", "back", "deck"].includes(normalizedHeader(header)))
      ? "anki"
      : "noteflow-csv";

  const indexes = {
    title: findColumn(headers, headerAliases.title),
    prompt: findColumn(headers, headerAliases.prompt),
    noteMarkdown: findColumn(headers, headerAliases.noteMarkdown),
    skill: findColumn(headers, headerAliases.skill),
    tags: findColumn(headers, headerAliases.tags),
    mode: findColumn(headers, headerAliases.mode),
    hintKeywords: findColumn(headers, headerAliases.hintKeywords),
    scaffold: findColumn(headers, headerAliases.scaffold),
  };

  const warnings: string[] = [];
  const cards: NoteCard[] = [];

  dataRows.forEach((row, rowIndex) => {
    const get = (index: number) => (index >= 0 ? row[index]?.trim() ?? "" : "");
    const rawPrompt = get(indexes.prompt);
    const rawBack = get(indexes.noteMarkdown);
    const prompt = format === "anki" ? cleanAnkiHtml(rawPrompt) : rawPrompt;
    const noteMarkdown = format === "anki" ? cleanAnkiHtml(rawBack) : rawBack;

    if (!prompt && !noteMarkdown) return;
    if (!prompt) {
      warnings.push(t(
        `Row ${rowIndex + (hasHeader ? 2 : 1)} has no Front/prompt and was skipped.`,
        `第 ${rowIndex + (hasHeader ? 2 : 1)} 行缺少 Front/prompt，已跳过。`,
      ));
      return;
    }

    const tags = splitList(get(indexes.tags));
    const rawSkill = get(indexes.skill);
    const skillId = resolveSkill(rawSkill, tags, skills, fallbackSkillId);
    if (rawSkill && skillId === fallbackSkillId) {
      const recognized = skills.some(
        (skill) =>
          normalizedHeader(rawSkill) === normalizedHeader(skill.id) ||
          normalizedHeader(rawSkill) === normalizedHeader(skill.name),
      );
      if (!recognized) warnings.push(t(
        `“${rawSkill}” did not match a knowledge domain and was assigned to the default domain.`,
        `“${rawSkill}”未匹配知识领域，已归入默认领域。`,
      ));
    }

    const title =
      get(indexes.title) ||
      prompt.replace(/\s+/g, " ").slice(0, 72) ||
      t(`Imported note ${rowIndex + 1}`, `导入笔记 ${rowIndex + 1}`);
    const hintKeywords = splitList(get(indexes.hintKeywords));
    const scaffold = get(indexes.scaffold)
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);

    cards.push({
      id: `${idPrefix}-${rowIndex + 1}`,
      title,
      prompt,
      noteMarkdown,
      skillId,
      tags,
      mode: allowedMode(get(indexes.mode)),
      hintKeywords: hintKeywords.length > 0 ? hintKeywords : tags.slice(0, 3),
      scaffold:
        scaffold.length > 0
          ? scaffold
          : locale === "zh"
            ? ["先说出核心定义。", "解释它解决的问题。", "给出一个自己的例子。"]
            : ["State the core definition first.", "Explain the problem it solves.", "Give one example of your own."],
      goalRelevance: 0.65,
      dependencyValue: 0.5,
      uncertainty: 0.8,
    });
  });

  return { cards, warnings: [...new Set(warnings)], format };
}

export const noteFlowCsvTemplate = `title,prompt,noteMarkdown,skill,tags,mode,hintKeywords,scaffold
"Meeting Rooms","Explain the heap invariant","## Core model","intervals","heap|interview","solve","earliest end|reuse room","Sort by start|Check earliest end|Update heap"`;
