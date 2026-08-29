"use client";

import { useMemo, useState } from "react";
import {
  noteFlowCsvTemplate,
  parseNoteImport,
  type NoteImportResult,
} from "../lib/import-notes";
import { parseAnkiPackage } from "../lib/import-anki-package";
import type { NoteCard, SkillState } from "../lib/flow-engine";
import { useLocale } from "./locale";

type EditableCardFields =
  | "title"
  | "prompt"
  | "noteMarkdown"
  | "skillId"
  | "tags"
  | "mode";

type NoteLibraryProps = {
  cards: NoteCard[];
  activeProjectTag?: string;
  skills: SkillState[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onChange: (id: string, patch: Partial<Pick<NoteCard, EditableCardFields>>) => void;
  onBulkChange: (
    ids: string[],
    patch: Partial<Pick<NoteCard, "skillId" | "tags" | "mode">>,
  ) => void;
  onBulkAddTag: (ids: string[], tag: string) => void;
  onDelete: (ids: string[]) => void;
  onImport: (cards: NoteCard[], newSkills: SkillState[]) => void;
  onLearn: () => void;
};

const parseTags = (value: string) =>
  [...new Set(value.split(/[|;,]+/).map((tag) => tag.trim()).filter(Boolean))];

function TagEditor({
  card,
  onChange,
}: {
  card: NoteCard;
  onChange: (tags: string[]) => void;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState((card.tags ?? []).join(", "));

  const commit = () => onChange(parseTags(value));

  return (
    <label className="tag-editor-field">
      <span>{t("Tags", "标签")}</span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
            event.currentTarget.blur();
          }
        }}
        placeholder={t("e.g. java, interview, heap", "例如：java, interview, heap")}
      />
    </label>
  );
}

export function NoteLibrary({
  cards,
  activeProjectTag = "",
  skills,
  selectedId,
  onSelect,
  onCreate,
  onChange,
  onBulkChange,
  onBulkAddTag,
  onDelete,
  onImport,
  onLearn,
}: NoteLibraryProps) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<NoteImportResult | null>(null);
  const [importFallbackSkill, setImportFallbackSkill] = useState(skills[0]?.id ?? "intervals");
  const [importFileName, setImportFileName] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);

  const projectCards = useMemo(() => activeProjectTag
    ? cards.filter((card) => {
        const projectTags = (card.tags ?? []).filter((tag) => tag.startsWith("project:"));
        return projectTags.length === 0 || projectTags.includes(activeProjectTag);
      })
    : cards, [activeProjectTag, cards]);
  const visibleCards = showAllProjects ? cards : projectCards;
  const hiddenProjectCount = cards.length - projectCards.length;
  const selected = visibleCards.find((card) => card.id === selectedId) ?? visibleCards[0];
  const skillName = skills.find((skill) => skill.id === selected?.skillId)?.name;

  const filteredCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return visibleCards;
    return visibleCards.filter((card) =>
      [
        card.title,
        card.prompt,
        card.noteMarkdown,
        ...(card.tags ?? []),
        skills.find((skill) => skill.id === card.skillId)?.name ?? card.skillId,
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query, skills, visibleCards]);

  const allFilteredSelected =
    filteredCards.length > 0 && filteredCards.every((card) => selectedIds.has(card.id));

  const toggleSelected = (cardId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredCards.forEach((card) => next.delete(card.id));
      else filteredCards.forEach((card) => next.add(card.id));
      return next;
    });
  };

  const addBulkTag = () => {
    const tag = bulkTag.trim();
    if (!tag || selectedIds.size === 0) return;
    onBulkAddTag([...selectedIds], tag);
    setBulkTag("");
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      t(
        `Delete the ${selectedIds.size} selected knowledge objects? Related memory records will also be removed.`,
        `确定删除选中的 ${selectedIds.size} 个知识对象吗？相关记忆记录也会一起删除。`,
      ),
    );
    if (!confirmed) return;
    onDelete([...selectedIds]);
    setSelectedIds(new Set());
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImportBusy(true);
    setImportFileName(file.name);
    setImportPreview(null);
    const idPrefix = `import-${Date.now()}`;
    try {
      const result = /\.(apkg|colpkg)$/i.test(file.name)
        ? await parseAnkiPackage(file, skills, importFallbackSkill, idPrefix, locale)
        : parseNoteImport(await file.text(), skills, importFallbackSkill, idPrefix, locale);
      setImportPreview(result);
    } finally {
      setImportBusy(false);
    }
  };

  const commitImport = () => {
    if (!importPreview?.cards.length) return;
    onImport(importPreview.cards, importPreview.newSkills);
    onSelect(importPreview.cards[0].id);
    setImportPreview(null);
    setImportOpen(false);
  };

  const downloadTemplate = () => {
    const blob = new Blob([noteFlowCsvTemplate], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "noteflow-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="notes-workspace">
      <aside className="notes-sidebar">
        <div className="notes-sidebar-heading">
          <div>
            <p className="eyebrow">{t("Knowledge objects", "知识对象")}</p>
            <h1>{t("Note library", "笔记库")}</h1>
          </div>
          <div className="library-create-actions">
            <button type="button" className="import-button" onClick={() => setImportOpen(true)}>
              {t("Import", "导入")}
            </button>
            <button type="button" className="new-note-button" onClick={onCreate}>＋ {t("New note", "新笔记")}</button>
          </div>
        </div>

        <label className="note-search">
          <span className="sr-only">{t("Search notes", "搜索笔记")}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search titles, notes, domains, or tags", "搜索标题、正文、领域或标签")}
          />
        </label>

        {activeProjectTag && hiddenProjectCount > 0 && (
          <div className="library-project-toggle" role="group" aria-label={t("Project visibility", "项目显示范围")}>
            <button type="button" className={!showAllProjects ? "selected" : ""} onClick={() => setShowAllProjects(false)}>
              {t("Current project", "当前项目")}
            </button>
            <button type="button" className={showAllProjects ? "selected" : ""} onClick={() => setShowAllProjects(true)}>
              {t(`Show all projects · ${cards.length}`, `显示所有项目 · ${cards.length}`)}
            </button>
          </div>
        )}

        <div className="selection-heading">
          <label>
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAllFiltered}
              aria-label={t("Select current search results", "选择当前搜索结果")}
            />
            <span>{selectedIds.size > 0 ? t(`${selectedIds.size} selected`, `已选择 ${selectedIds.size} 项`) : t(`${visibleCards.length} total`, `共 ${visibleCards.length} 项`)}</span>
          </label>
          {selectedIds.size > 0 && (
            <button type="button" onClick={() => setSelectedIds(new Set())}>{t("Clear selection", "取消选择")}</button>
          )}
        </div>

        <div className="note-list">
          {filteredCards.map((card) => (
            <div className={`note-list-row ${card.id === selected?.id ? "selected" : ""}`} key={card.id}>
              <input
                type="checkbox"
                checked={selectedIds.has(card.id)}
                onChange={() => toggleSelected(card.id)}
                aria-label={t(`Select ${card.title}`, `选择 ${card.title}`)}
              />
              <button type="button" className="note-row-main" onClick={() => onSelect(card.id)}>
                <span>
                  {skills.find((skill) => skill.id === card.skillId)?.name ?? card.skillId}
                  {(card.tags ?? []).slice(0, 2).map((tag) => <i key={tag}>#{tag}</i>)}
                </span>
                <strong>{card.title}</strong>
                <small>{card.noteMarkdown ? t("Note back available", "有笔记背面") : t("Needs content", "等待补充")}</small>
              </button>
            </div>
          ))}
          {filteredCards.length === 0 && <p className="empty-search">{t("No matching notes.", "没有匹配的笔记。")}</p>}
        </div>
      </aside>

      <div className="library-main">
        {selectedIds.size > 0 && (
          <section className="bulk-toolbar" aria-label={t("Bulk management", "批量管理")}>
            <strong>{t(`${selectedIds.size} items`, `${selectedIds.size} 项`)}</strong>
            <label>
              <span>{t("Knowledge domain", "知识领域")}</span>
              <select
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) {
                    onBulkChange([...selectedIds], { skillId: event.target.value });
                    event.target.value = "";
                  }
                }}
              >
                <option value="" disabled>{t("Move selected to…", "批量移动到…")}</option>
                {skills.map((skill) => <option value={skill.id} key={skill.id}>{skill.name}</option>)}
              </select>
            </label>
            <label className="bulk-tag-field">
              <span className="sr-only">{t("Add a tag to selected notes", "批量添加标签")}</span>
              <input
                value={bulkTag}
                onChange={(event) => setBulkTag(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addBulkTag();
                }}
                placeholder={t("Add tag", "添加标签")}
              />
              <button type="button" onClick={addBulkTag}>{t("Add", "添加")}</button>
            </label>
            <button type="button" className="danger-button" onClick={deleteSelected}>{t("Delete", "删除")}</button>
          </section>
        )}

        {selected ? (
          <article className="note-editor">
            <header className="note-editor-heading">
              <div>
                <span>{skillName} · {t("note side of the same object", "同一对象的笔记面")}</span>
                <h2>{t("Domains and tags travel with the knowledge object into scheduling and export.", "领域与标签会跟着知识对象一起进入调度和导出。")}</h2>
              </div>
              <button type="button" className="secondary-button" onClick={onLearn}>
                {t("Start learning", "去学习")}
                <span aria-hidden="true">→</span>
              </button>
            </header>

            <div className="card-metadata-fields">
              <label>
                <span>{t("Knowledge domain", "知识领域")}</span>
                <select
                  value={selected.skillId}
                  onChange={(event) => onChange(selected.id, { skillId: event.target.value })}
                >
                  {skills.map((skill) => <option value={skill.id} key={skill.id}>{skill.name}</option>)}
                </select>
              </label>
              <label>
                <span>{t("Retrieval mode", "检索模式")}</span>
                <select
                  value={selected.mode}
                  onChange={(event) =>
                    onChange(selected.id, { mode: event.target.value as NoteCard["mode"] })
                  }
                >
                  <option value="recall">{t("Recall", "Recall · 回忆")}</option>
                  <option value="solve">{t("Solve", "Solve · 解题")}</option>
                  <option value="design">{t("Design", "Design · 设计")}</option>
                  <option value="speak">{t("Speak", "Speak · 口述")}</option>
                </select>
              </label>
              <TagEditor
                key={selected.id}
                card={selected}
                onChange={(tags) => onChange(selected.id, { tags })}
              />
            </div>

            <label className="editor-field title-field">
              <span>{t("Title", "标题")}</span>
              <input
                value={selected.title}
                onChange={(event) => onChange(selected.id, { title: event.target.value })}
              />
            </label>

            <label className="editor-field">
              <span>{t("Retrieval prompt · card front", "检索问题 · 卡片正面")}</span>
              <textarea
                className="prompt-editor"
                value={selected.prompt}
                onChange={(event) => onChange(selected.id, { prompt: event.target.value })}
              />
            </label>

            <label className="editor-field markdown-editor">
              <span>{t("Markdown note · card back", "Markdown 笔记 · 卡片背面")}</span>
              <textarea
                value={selected.noteMarkdown}
                onChange={(event) => onChange(selected.id, { noteMarkdown: event.target.value })}
                placeholder={t("## Core concept\n\nWrite the explanation, examples, and likely sticking points…", "## 核心概念\n\n写下解释、例子和容易卡住的地方……")}
              />
            </label>

            <footer className="editor-footer">
              <span><i /> {t("Automatically saved to the NoteFlow database", "自动保存到 NoteFlow 数据库")}</span>
              <span>{t("One object · two views", "一个对象 · 两个视图")}</span>
            </footer>
          </article>
        ) : (
          <section className="empty-library">
            <p className="eyebrow">{t("The note library is empty", "笔记库为空")}</p>
            <h2>{t("Create a note or import from CSV / Anki.", "新建一条笔记，或从 CSV / Anki 导入。")}</h2>
            <button type="button" className="primary-button" onClick={onCreate}>{t("Create note", "新建笔记")}</button>
          </section>
        )}
      </div>

      {importOpen && (
        <div className="import-overlay" role="presentation">
          <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <header>
              <div>
                <p className="eyebrow">{t("Bulk import", "批量导入")}</p>
                <h2 id="import-title">{t("Import a CSV or Anki file", "导入 CSV 或 Anki 文件")}</h2>
              </div>
              <button type="button" onClick={() => setImportOpen(false)} aria-label={t("Close import", "关闭导入")}>×</button>
            </header>

            <div className="import-format-grid">
              <div>
                <strong>{t("Anki deck package", "Anki 牌组包")}</strong>
                <p>{t("Import downloaded .apkg decks or .colpkg collections directly. Text fields, deck names, and tags are kept; scheduling and media are ignored.", "直接导入网上下载的 .apkg 牌组或 .colpkg 集合。保留文字字段、牌组名和标签；不导入复习进度与媒体。")}</p>
              </div>
              <div>
                <strong>{t("Anki plain-text export", "Anki 纯文本导出")}</strong>
                <p>{t("Import Anki's Notes in Plain Text .txt directly. #separator, #deck, #tags, GUID, and note-type column directives are detected automatically.", "直接导入 Anki 的“纯文本格式的笔记” .txt。自动识别 #separator、#deck、#tags、GUID 与笔记类型列。")}</p>
              </div>
              <div>
                <strong>NoteFlow CSV</strong>
                <p>{t("For full control: title, prompt, noteMarkdown, skill, tags, mode, hints, and scaffold.", "需要完整控制时使用：title、prompt、noteMarkdown、skill、tags、mode、提示与骨架。")}</p>
                <button type="button" onClick={downloadTemplate}>{t("Download CSV template", "下载 CSV 模板")}</button>
              </div>
            </div>

            <details className="import-guide">
              <summary>{t("How should I export from Anki?", "如何从 Anki 导出？")}</summary>
              <ol>
                <li>{t("In Anki, choose File → Export.", "在 Anki 中选择“文件 → 导出”。")}</li>
                <li>{t("Fastest: choose Anki Deck Package (.apkg) and select the deck. NoteFlow can read it directly.", "最省事：选择“Anki 牌组包（.apkg）”并选定牌组，NoteFlow 可以直接读取。")}</li>
                <li>{t("Most compatible: choose Notes in Plain Text (.txt). You may include HTML, tags, and deck name.", "兼容性最好：选择“纯文本格式的笔记（.txt）”，可以包含 HTML、标签和牌组名。")}</li>
              </ol>
              <p>{t("Keep the # lines at the top of Anki's .txt file—NoteFlow uses them to map the columns correctly.", "请保留 Anki .txt 顶部的 # 指令行；NoteFlow 会用它们正确识别每一列。")}</p>
            </details>

            <label className="import-fallback">
              <span>{t("Use this domain only when the file has no Deck / skill", "仅当文件没有 Deck / skill 时归入")}</span>
              <select
                value={importFallbackSkill}
                onChange={(event) => setImportFallbackSkill(event.target.value)}
              >
                {skills.map((skill) => <option value={skill.id} key={skill.id}>{skill.name}</option>)}
              </select>
            </label>

            <label className="file-drop">
              <input
                type="file"
                accept=".apkg,.colpkg,.csv,.tsv,.txt,application/zip,text/plain,text/csv,text/tab-separated-values"
                disabled={importBusy}
                onChange={(event) => {
                  void handleImportFile(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <strong>{importBusy
                ? t("Reading the Anki file…", "正在读取 Anki 文件……")
                : t("Choose an Anki package, Anki .txt, or CSV", "选择 Anki 包、Anki .txt 或 CSV")}</strong>
              <span>{importFileName || t(".apkg · .colpkg · .txt · .csv · .tsv", ".apkg · .colpkg · .txt · .csv · .tsv")}</span>
            </label>

            {importPreview && (
              <div className="import-preview">
                <div className="import-preview-heading">
                  <div>
                    <strong>{t(`${importPreview.cards.length} ready to import`, `${importPreview.cards.length} 条可导入`)}</strong>
                    <span>{importPreview.format === "anki-package"
                      ? t("Detected Anki package", "检测为 Anki 牌组包")
                      : importPreview.format === "anki-text"
                        ? t("Detected Anki plain-text export", "检测为 Anki 纯文本导出")
                        : t("Detected NoteFlow CSV", "检测为 NoteFlow CSV")}</span>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={importPreview.cards.length === 0}
                    onClick={commitImport}
                  >
                    {t("Import", "确认导入")}
                  </button>
                </div>
                {importPreview.warnings.length > 0 && (
                  <ul className="import-warnings">
                    {importPreview.warnings.slice(0, 5).map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                )}
                <div className="import-card-preview">
                  {importPreview.cards.slice(0, 4).map((card) => (
                    <div key={card.id}>
                      <span>{[...skills, ...importPreview.newSkills].find((skill) => skill.id === card.skillId)?.name}</span>
                      <strong>{card.title}</strong>
                      <small>{card.tags.map((tag) => `#${tag}`).join(" ") || t("No tags", "无标签")}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
