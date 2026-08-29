import type { SkillState } from "./flow-engine";
import { parseNoteImport, type NoteImportResult } from "./import-notes";

const collectionEntryNames = new Set([
  "collection.21b",
  "collection.anki21b",
  "collection.anki21",
  "collection.anki2",
]);

const sqliteSignature = "SQLite format 3\0";
const maxPackageBytes = 256 * 1024 * 1024;
const maxCollectionBytes = 128 * 1024 * 1024;
const maxImportedNotes = 10_000;

function emptyResult(message: string): NoteImportResult {
  return {
    cards: [],
    warnings: [message],
    format: "anki-package",
    newSkills: [],
  };
}

function quoteTsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function sqliteFile(collectionEntries: Record<string, Uint8Array>) {
  const compressed = collectionEntries["collection.21b"] ?? collectionEntries["collection.anki21b"];
  if (compressed) return import("fzstd").then(({ decompress }) => decompress(compressed));
  return Promise.resolve(
    collectionEntries["collection.anki21"] ?? collectionEntries["collection.anki2"],
  );
}

function isSqlite(bytes: Uint8Array | undefined) {
  if (!bytes || bytes.length < sqliteSignature.length) return false;
  return new TextDecoder().decode(bytes.slice(0, sqliteSignature.length)) === sqliteSignature;
}

export async function parseAnkiPackage(
  file: File,
  skills: SkillState[],
  fallbackSkillId: string,
  idPrefix = `import-${Date.now()}`,
  locale: "en" | "zh" = "en",
  sqlWasmUrl = "/sql-wasm.wasm",
): Promise<NoteImportResult> {
  const t = (english: string, chinese: string) => locale === "zh" ? chinese : english;

  if (file.size > maxPackageBytes) {
    return emptyResult(t(
      "This Anki package is larger than 256 MB. Export it from Anki as Notes in Plain Text, without media, and import the .txt file instead.",
      "这个 Anki 包超过 256 MB。请在 Anki 中导出为“纯文本格式的笔记”，不包含媒体，再导入 .txt 文件。",
    ));
  }

  try {
    const { unzipSync } = await import("fflate");
    const archive = new Uint8Array(await file.arrayBuffer());
    let collectionTooLarge = false;
    const entries = unzipSync(archive, {
      filter: ({ name, originalSize }) => {
        const isCollection = collectionEntryNames.has(name);
        if (isCollection && originalSize > maxCollectionBytes) collectionTooLarge = true;
        return isCollection && originalSize <= maxCollectionBytes;
      },
    });
    if (collectionTooLarge) {
      return emptyResult(t(
        "The collection inside this package is too large for safe browser import. Export the deck as Notes in Plain Text instead.",
        "这个包内的集合过大，无法在浏览器中安全导入。请改为导出“纯文本格式的笔记”。",
      ));
    }
    const collection = await sqliteFile(entries);

    if (!isSqlite(collection)) {
      return emptyResult(t(
        "This package does not contain a readable Anki collection. Try exporting the deck again with “Support older Anki versions” enabled, or use Notes in Plain Text.",
        "这个包里没有可读取的 Anki 数据库。请重新导出并勾选“支持较旧的 Anki 版本”，或改用“纯文本格式的笔记”。",
      ));
    }

    const { default: initSqlJs } = await import("sql.js");
    const SQL = await initSqlJs({
      locateFile: (name) => name.endsWith(".wasm") ? sqlWasmUrl : name,
    });
    const database = new SQL.Database(collection);

    try {
      const deckNames = new Map<string, string>();
      const deckResult = database.exec("SELECT decks FROM col LIMIT 1")[0];
      const rawDecks = deckResult?.values[0]?.[0];
      if (typeof rawDecks === "string") {
        const parsedDecks = JSON.parse(rawDecks) as Record<string, { name?: string }>;
        Object.entries(parsedDecks).forEach(([id, deck]) => {
          if (deck?.name) deckNames.set(id, deck.name);
        });
      }

      const notesResult = database.exec(`
        SELECT n.id, n.flds, n.tags, COALESCE(MIN(c.did), 1) AS did
        FROM notes n
        LEFT JOIN cards c ON c.nid = n.id
        GROUP BY n.id
        ORDER BY n.id
      `)[0];
      const allRows = notesResult?.values ?? [];
      const selectedRows = allRows.slice(0, maxImportedNotes);
      const textRows = selectedRows.map((row) => {
        const fields = typeof row[1] === "string" ? row[1].split("\u001f") : [];
        const front = fields[0] ?? "";
        const back = fields.slice(1).filter(Boolean).join("<br><br>");
        const tags = typeof row[2] === "string" ? row[2].trim() : "";
        const deck = deckNames.get(String(row[3])) ?? t("Imported Anki deck", "导入的 Anki 牌组");
        return [deck, front, back, tags].map(quoteTsv).join("\t");
      });
      const syntheticText = [
        "#separator:tab",
        "#html:true",
        "#deck column:1",
        "#tags column:4",
        ...textRows,
      ].join("\n");
      const parsed = parseNoteImport(
        syntheticText,
        skills,
        fallbackSkillId,
        idPrefix,
        locale,
      );
      const warnings = [...parsed.warnings];
      if (allRows.length > maxImportedNotes) {
        warnings.unshift(t(
          `This package contains ${allRows.length} notes. The first ${maxImportedNotes} were prepared to keep the browser responsive.`,
          `这个包包含 ${allRows.length} 条笔记。为避免浏览器卡顿，本次准备了前 ${maxImportedNotes} 条。`,
        ));
      }
      if (parsed.cards.length === 0 && allRows.length > 0) {
        warnings.unshift(t(
          "The package contains notes, but their first fields have no readable text. Image-only and audio-only cards cannot become retrieval prompts yet.",
          "包里有笔记，但第一字段没有可读取的文字。纯图片或纯音频卡片暂时不能转成检索问题。",
        ));
      }
      return { ...parsed, format: "anki-package", warnings };
    } finally {
      database.close();
    }
  } catch (error) {
    console.error("Failed to parse Anki package", error);
    return emptyResult(t(
      "NoteFlow could not read this package. Export it from Anki as Notes in Plain Text (.txt), or re-export the .apkg with “Support older Anki versions” enabled.",
      "NoteFlow 无法读取这个包。请从 Anki 导出为“纯文本格式的笔记（.txt）”，或重新导出 .apkg 并勾选“支持较旧的 Anki 版本”。",
    ));
  }
}
