"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  applyMemoryFeedback,
  createInitialCardMemory,
  defaultGoalProfile,
  initialSkills,
  noteCards,
  rankCards,
  recordSilentSkip,
  updateCardMemory,
  type CardMemory,
  type GoalProfile,
  type MemoryDelta,
  type MemoryFeedback,
  type NoteCard,
  type RetrievalEvidence,
  type SkillState,
} from "../lib/flow-engine";
import {
  createRetrievalTitle,
  extractAgentSection,
  extractAgentText,
  latestRhythmKey,
  projectKnowledgeAreas,
  type HackathonHandoff,
  type RhythmRevision,
} from "../lib/hackathon-handoff";
import { GoalPlanner } from "./goal-planner";
import { LanguageSwitch, useLocale, type Locale } from "./locale";
import { NoteLibrary } from "./note-library";

type Phase =
  | "pre"
  | "idle"
  | "attempt"
  | "hint-keywords"
  | "hint-scaffold"
  | "note"
  | "feedback"
  | "delta"
  | "post";

type StoredMemory = {
  goalProfile: GoalProfile;
  skills: SkillState[];
  cardMemory: Record<string, CardMemory>;
  evidence: RetrievalEvidence[];
  generatedCards: NoteCard[];
  generatedNotes: Record<string, string>;
  deletedCardIds: string[];
};

const legacyStorageKey = "noteflow-memory-v2";

type NoteFlowUser = {
  id: string;
  displayName: string;
  email: string;
  authProvider: string;
};

type NoteFlowAppProps = {
  user: NoteFlowUser;
  getAccessToken: () => Promise<string | null>;
  onSignOut: () => Promise<void>;
  isGuest?: boolean;
  agentHandoff?: HackathonHandoff | null;
};

function richText(line: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function MarkdownNote({ source }: { source: string }) {
  return (
    <div className="markdown-note">
      {source.split("\n").map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <div className="note-space" key={index} />;
        if (line.startsWith("### ")) return <h4 key={index}>{richText(line.slice(4))}</h4>;
        if (line.startsWith("## ")) return <h3 key={index}>{richText(line.slice(3))}</h3>;
        if (line.startsWith("> ")) return <blockquote key={index}>{richText(line.slice(2))}</blockquote>;
        if (line.startsWith("- ")) {
          return (
            <div className="note-bullet" key={index}>
              <span aria-hidden="true" />
              <p>{richText(line.slice(2))}</p>
            </div>
          );
        }
        return <p key={index}>{richText(line)}</p>;
      })}
    </div>
  );
}

function skillSignal(skill: SkillState, locale: Locale) {
  return skill.id === "expression"
    ? { label: locale === "zh" ? "表达可提取性" : "Expression recall", value: skill.expression }
    : { label: locale === "zh" ? "记忆保持度" : "Memory retention", value: skill.retention };
}

function SkillStateView({
  skills,
  title,
  eyebrow,
  isGuest = false,
}: {
  skills: SkillState[];
  title: string;
  eyebrow: string;
  isGuest?: boolean;
}) {
  const { locale, t } = useLocale();

  return (
    <section className="skill-state-card">
      <div className="state-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span className="local-pill"><i /> {isGuest
          ? t("Demo signals · this browser", "演示信号 · 当前浏览器")
          : t("Saved to your private space", "保存到私人空间")}</span>
      </div>
      <div className="state-grid">
        {skills.map((skill) => {
          const signal = skillSignal(skill, locale);
          const percent = Math.round(signal.value * 100);
          return (
            <div className="state-item" key={skill.id}>
              <div className="state-label">
                <div>
                  <strong>{skill.name}</strong>
                  <span>{signal.label}</span>
                </div>
                <b>{percent}%</b>
              </div>
              <div
                className="state-track"
                role="progressbar"
                aria-label={`${skill.name} ${signal.label}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <span style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AgentPlanPreview({
  handoff,
  onOpenNotes,
}: {
  handoff: HackathonHandoff;
  onOpenNotes: () => void;
}) {
  const { t } = useLocale();
  const themes = handoff.generatedPlan?.themes ?? [];

  return (
    <section className="skill-state-card agent-plan-preview">
      <div className="state-heading">
        <div>
          <p className="eyebrow">{t("After you press Start", "点击开始之后")}</p>
          <h2>{t("First retrieval ready", "第一次检索已准备好")}</h2>
        </div>
        <span className="local-pill"><i /> {t("Cloud plan · browser session", "云端计划 · 浏览器 Session")}</span>
      </div>
      <div className="queued-retrieval">
        <span>{t("Agent-selected", "Agent 已选择")}</span>
        <strong>{handoff.title}</strong>
        <p>{handoff.nextRetrievalPrompts[0]}</p>
      </div>
      {themes.length > 0 && (
        <div className="preview-themes">
          <span>{t("Generated themes", "生成的主题")}</span>
          <div>{themes.map((theme) => <i key={theme}>{theme}</i>)}</div>
        </div>
      )}
      <div className="plan-library-entry">
        <div>
          <span>{t("Before learning", "开始学习前")}</span>
          <strong>{t(
            "Prepare the notes this plan will use",
            "先准备这次计划要用的笔记",
          )}</strong>
          <p>{t(
            "Review the Agent-generated card, import notes you already have, or create your own. Return here to start when the material is ready.",
            "查看 Agent 生成的卡片、导入已有笔记，或添加自己的内容。资料设置完成后，再回来开始学习。",
          )}</p>
        </div>
        <button type="button" onClick={onOpenNotes}>
          {t("Open Notes", "打开笔记库")}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

function buildPrerequisiteCard(source: NoteCard, locale: Locale): NoteCard {
  const concept = source.hintKeywords[0] ?? source.title;

  if (locale === "en") {
    return {
      id: `prereq-${source.id}`,
      skillId: source.skillId,
      tags: [...new Set([...(source.tags ?? []), "prerequisite"])],
      mode: "recall",
      title: `Prerequisite: ${concept}`,
      prompt: `Before answering the original question, explain “${concept}” in your own words and why it is a prerequisite for ${source.title}.`,
      hintKeywords: source.hintKeywords,
      scaffold: [
        `Give a minimal definition of “${concept}”.`,
        "Explain the specific problem it solves.",
        `Connect it back to ${source.title}.`,
      ],
      noteMarkdown: `## Minimal prerequisite

**${concept}** is the missing connection needed to understand the original card.

## Retrieval target

- Define it in your own words.
- Explain the problem it solves.
- Connect it back to **${source.title}**.

This prerequisite card came from a “no direction” signal. It is not a debt.`,
      goalRelevance: source.goalRelevance,
      dependencyValue: 1,
      uncertainty: 0.86,
    };
  }

  return {
    id: `prereq-${source.id}`,
    skillId: source.skillId,
    tags: [...new Set([...(source.tags ?? []), "prerequisite"])],
    mode: "recall",
    title: `前置：${concept}`,
    prompt: `先不回答原问题。用自己的话解释“${concept}”，再说它为什么是 ${source.title} 的前置。`,
    hintKeywords: source.hintKeywords,
    scaffold: [
      `先给“${concept}”一个最小定义。`,
      "说明它解决的具体问题。",
      `最后把它连接回 ${source.title}。`,
    ],
    noteMarkdown: `## 最小前置

**${concept}** 是理解原卡片所缺少的连接点。

## 检索目标

- 能用自己的话定义它。
- 能说出它解决什么问题。
- 能把它连接回 **${source.title}**。

这张前置卡来自一次“完全没方向”的反馈，不是一项欠债。`,
    goalRelevance: source.goalRelevance,
    dependencyValue: 1,
    uncertainty: 0.86,
  };
}

function projectSkillsForHandoff(handoff: HackathonHandoff): SkillState[] {
  const areas = handoff.project?.knowledgeAreas
    ?? projectKnowledgeAreas(handoff.generatedPlan?.themes ?? [handoff.title]);
  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    mastery: 0.3,
    retention: 0.3,
    expression: 0.3,
    confidence: 0.3,
  }));
}

function retrievalModeForHandoff(handoff: HackathonHandoff): NoteCard["mode"] {
  const text = handoff.goal + "\n" + handoff.nextRetrievalPrompts.join("\n");
  if (/说|口语|发音|对话|speak|pronounc|conversation|language/i.test(text)) return "speak";
  if (/设计|架构|权衡|design|architect|trade-?off/i.test(text)) return "design";
  if (/解决|计算|算法|题目|solve|calculate|algorithm/i.test(text)) return "solve";
  return "recall";
}

function projectCardsForHandoff(
  handoff: HackathonHandoff,
  projectSkills: SkillState[],
  rationale: string,
): NoteCard[] {
  const themes = handoff.generatedPlan?.themes
    ?? handoff.project?.themes
    ?? projectSkills.map((skill) => skill.name);
  const projectId = handoff.project?.id ?? handoff.id;
  const projectTag = "project:" + projectId;
  const fallbackSkill = projectSkills[0] ?? {
    id: "project-focus",
    name: handoff.title,
    mastery: 0.3,
    retention: 0.3,
    expression: 0.3,
    confidence: 0.3,
  };

  return handoff.nextRetrievalPrompts.map((prompt, index) => {
    const skill = projectSkills[index % Math.max(projectSkills.length, 1)] ?? fallbackSkill;
    const theme = themes[index % Math.max(themes.length, 1)] ?? skill.name;
    const title = index === 0
      ? handoff.title
      : createRetrievalTitle(prompt, [theme], handoff.locale);
    const focusLines = [theme, ...themes.filter((item) => item !== theme).slice(0, 2)]
      .filter(Boolean)
      .map((item) => `- ${item}`)
      .join("\n");

    return {
      id: index === 0 ? handoff.id : `${handoff.id}-retrieval-${index + 1}`,
      skillId: skill.id,
      tags: ["agent-selected", projectTag, "retrieval", skill.id],
      mode: retrievalModeForHandoff(handoff),
      title,
      prompt,
      hintKeywords: [theme, ...themes.filter((item) => item !== theme)].filter(Boolean).slice(0, 3),
      scaffold: handoff.locale === "zh"
        ? ["先直接作答，不看笔记。", "说明你为什么这样判断。", "用自己的例子或下一步把答案说完整。"]
        : ["Answer directly without opening the note.", "Explain why you reached that answer.", "Complete it with your own example or next step."],
      noteMarkdown: handoff.locale === "zh"
        ? `## 为什么练习这一项\n\n${rationale}\n\n## 本卡重点\n\n${focusLines}`
        : `## Why this practice\n\n${rationale}\n\n## Card focus\n\n${focusLines}`,
      goalRelevance: Math.max(0.78, 0.95 - index * 0.03),
      dependencyValue: Math.max(0.7, 0.92 - index * 0.04),
      uncertainty: 0.82,
    };
  });
}

function planStartDate(profile: GoalProfile): Date | null {
  if (profile.startMode === "now") return new Date();
  if (profile.startMode !== "scheduled" || !profile.startDate || !profile.preferredTime) return null;
  const value = new Date(profile.startDate + "T" + profile.preferredTime + ":00");
  return Number.isNaN(value.getTime()) ? null : value;
}

function formatIcsDate(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function normalizeStoredCard(card: NoteCard): NoteCard {
  const rawRelevance = (card as unknown as { goalRelevance?: unknown }).goalRelevance;
  if (typeof rawRelevance === "number") return card;
  const legacyValues = rawRelevance && typeof rawRelevance === "object"
    ? Object.values(rawRelevance).filter((value): value is number => typeof value === "number")
    : [];
  return { ...card, goalRelevance: legacyValues.length > 0 ? Math.max(...legacyValues) : 0.65 };
}

export default function NoteFlowApp({
  user,
  getAccessToken,
  onSignOut,
  isGuest = false,
  agentHandoff = null,
}: NoteFlowAppProps) {
  const { locale, t } = useLocale();
  const storageKey = `noteflow-memory-v5:${user.id}:${agentHandoff?.id ?? "default"}`;
  const legacyUserStorageKey = `noteflow-memory-v4:${user.id}`;
  const legacyAccountStorageKey = `noteflow-memory-v3:${user.email.trim().toLowerCase()}`;
  const [phase, setPhase] = useState<Phase>("pre");
  const [workspaceView, setWorkspaceView] = useState<"notes" | "learn">("learn");
  const [goalProfile, setGoalProfile] = useState<GoalProfile>(defaultGoalProfile);
  const [selectedNoteId, setSelectedNoteId] = useState(noteCards[0].id);
  const [skills, setSkills] = useState<SkillState[]>(initialSkills);
  const [cardMemory, setCardMemory] = useState<Record<string, CardMemory>>(
    createInitialCardMemory(noteCards),
  );
  const [evidence, setEvidence] = useState<RetrievalEvidence[]>([]);
  const [generatedCards, setGeneratedCards] = useState<NoteCard[]>([]);
  const [deletedCardIds, setDeletedCardIds] = useState<string[]>([]);
  const [sessionQueue, setSessionQueue] = useState<string[]>([]);
  const [hintDepth, setHintDepth] = useState<0 | 1 | 2>(0);
  const [reactionMs, setReactionMs] = useState(0);
  const [attemptOutcome, setAttemptOutcome] = useState<"fluent" | "stuck" | null>(null);
  const [memoryDelta, setMemoryDelta] = useState<MemoryDelta | null>(null);
  const [gapSentence, setGapSentence] = useState("");
  const [generatedNotes, setGeneratedNotes] = useState<Record<string, string>>({});
  const [hasRestored, setHasRestored] = useState(false);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "ready" | "error">("idle");
  const [recordingError, setRecordingError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [agentSyncStage, setAgentSyncStage] = useState<"idle" | "running" | "complete" | "error">("idle");
  const [rhythmRevision, setRhythmRevision] = useState<RhythmRevision | null>(null);
  const [reminderStatus, setReminderStatus] = useState("");

  const attemptStartedAt = useRef(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const appliedHandoffId = useRef<string | null>(null);
  const restoredProjectState = useRef(false);
  const reminderTimer = useRef<number | null>(null);
  const activeProjectTag = agentHandoff ? "project:" + (agentHandoff.project?.id ?? agentHandoff.id) : "";

  const allCards = useMemo(() => {
    const edits = new Map(generatedCards.map((card) => [card.id, card]));
    const baseIds = new Set(noteCards.map((card) => card.id));
    const merged = activeProjectTag
      ? generatedCards.filter((card) => card.tags?.includes(activeProjectTag))
      : [
          ...noteCards.map((card) => edits.get(card.id) ?? card),
          ...generatedCards.filter((card) => !baseIds.has(card.id)),
        ];

    return merged
      .filter((card) => !deletedCardIds.includes(card.id))
      .map((card) => ({
        ...card,
        tags: card.tags ?? [card.skillId],
        noteMarkdown:
          generatedNotes[card.id] !== undefined
            ? generatedNotes[card.id]
            : card.noteMarkdown,
      }));
  }, [activeProjectTag, deletedCardIds, generatedCards, generatedNotes]);
  const currentCard = allCards.find((card) => card.id === sessionQueue[0]);

  useEffect(() => {
    const awaitingAgentHandoff = !agentHandoff
      && new URLSearchParams(window.location.search).get("source") === "agent";
    if (awaitingAgentHandoff) return;

    const applyStored = (parsed: StoredMemory) => {
      const storedProfile = parsed.goalProfile as (Partial<GoalProfile> & { mode?: "steady" | "sprint" }) | undefined;
      setGoalProfile({
        ...defaultGoalProfile,
        title: storedProfile?.title ?? defaultGoalProfile.title,
        roleBaseline: storedProfile?.roleBaseline ?? defaultGoalProfile.roleBaseline,
        themes: storedProfile?.themes ?? defaultGoalProfile.themes,
        paceBias: storedProfile?.paceBias ?? (storedProfile?.mode === "sprint" ? 78 : 25),
        sessionMinutesMin: storedProfile?.sessionMinutesMin ?? defaultGoalProfile.sessionMinutesMin,
        sessionMinutesMax: storedProfile?.sessionMinutesMax ?? defaultGoalProfile.sessionMinutesMax,
        invitationsPerWeekMin: storedProfile?.invitationsPerWeekMin ?? defaultGoalProfile.invitationsPerWeekMin,
        invitationsPerWeekMax: storedProfile?.invitationsPerWeekMax ?? defaultGoalProfile.invitationsPerWeekMax,
        studyPattern: storedProfile?.studyPattern ?? defaultGoalProfile.studyPattern,
        energyWindow: storedProfile?.energyWindow ?? defaultGoalProfile.energyWindow,
        preferredTime: storedProfile?.preferredTime ?? defaultGoalProfile.preferredTime,
        reminderOptIn: storedProfile?.reminderOptIn ?? defaultGoalProfile.reminderOptIn,
        dailyMinutes: storedProfile?.dailyMinutes ?? defaultGoalProfile.dailyMinutes,
        startMode: storedProfile?.startMode ?? defaultGoalProfile.startMode,
        startDate: storedProfile?.startDate ?? defaultGoalProfile.startDate,
        timeZone: storedProfile?.timeZone ?? defaultGoalProfile.timeZone,
        sprintDeadline: storedProfile?.sprintDeadline ?? "",
        focusSkillIds: storedProfile?.focusSkillIds ?? [],
      });
      setSkills(parsed.skills ?? initialSkills);
      setCardMemory({
        ...createInitialCardMemory(agentHandoff
          ? (parsed.generatedCards ?? [])
          : [...noteCards, ...(parsed.generatedCards ?? [])]),
        ...(parsed.cardMemory ?? {}),
      });
      setEvidence(parsed.evidence ?? []);
      setGeneratedCards(
        (parsed.generatedCards ?? []).map((storedCard) => {
          const card = normalizeStoredCard(storedCard);
          return { ...card, tags: card.tags ?? [card.skillId] };
        }),
      );
      setGeneratedNotes(parsed.generatedNotes ?? {});
      setDeletedCardIds(parsed.deletedCardIds ?? []);
    };

    const restoreFrame = window.requestAnimationFrame(() => {
      void (async () => {
        let parsed: StoredMemory | null = null;

        try {
          const accessToken = await getAccessToken();
          if (accessToken && !agentHandoff) {
            const response = await fetch("/api/state", {
              headers: {
                accept: "application/json",
                authorization: `Bearer ${accessToken}`,
              },
            });
            if (response.ok) {
              const payload = (await response.json()) as { state: StoredMemory | null };
              parsed = payload.state;
            }
          }
        } catch {
          // The D1-backed private workspace may be unavailable while offline.
        }

        if (!parsed) {
          try {
            const scopedSaved = window.localStorage.getItem(storageKey);
            const saved = scopedSaved
              ?? (!agentHandoff ? window.localStorage.getItem(legacyUserStorageKey) : null)
              ?? (!agentHandoff ? window.localStorage.getItem(legacyAccountStorageKey) : null)
              ?? (!agentHandoff ? window.localStorage.getItem(legacyStorageKey) : null);
            if (saved) {
              parsed = JSON.parse(saved) as StoredMemory;
              if (agentHandoff && scopedSaved) restoredProjectState.current = true;
            }
          } catch {
            window.localStorage.removeItem(storageKey);
            if (!agentHandoff) {
              window.localStorage.removeItem(legacyAccountStorageKey);
              window.localStorage.removeItem(legacyUserStorageKey);
              window.localStorage.removeItem(legacyStorageKey);
            }
          }
        }

        if (parsed) applyStored(parsed);
        setHasRestored(true);
      })();
    });

    return () => window.cancelAnimationFrame(restoreFrame);
  }, [agentHandoff, getAccessToken, legacyAccountStorageKey, legacyUserStorageKey, storageKey]);

  useEffect(() => {
    if (!hasRestored) return;

    const stored: StoredMemory = {
      goalProfile,
      skills,
      cardMemory,
      evidence,
      generatedCards,
      generatedNotes,
      deletedCardIds,
    };

    const saveTimer = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, JSON.stringify(stored));
      if (!agentHandoff) {
        window.localStorage.removeItem(legacyAccountStorageKey);
        window.localStorage.removeItem(legacyUserStorageKey);
        window.localStorage.removeItem(legacyStorageKey);
      }
      void (async () => {
        if (agentHandoff) return;
        const accessToken = await getAccessToken();
        if (!accessToken) return;
        await fetch("/api/state", {
          method: "PUT",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(stored),
        });
      })().catch(() => {
        // localStorage remains an offline cache; D1 is retried on the next change.
      });
    }, 350);

    return () => window.clearTimeout(saveTimer);
  }, [agentHandoff, cardMemory, deletedCardIds, evidence, generatedCards, generatedNotes, getAccessToken, goalProfile, hasRestored, legacyAccountStorageKey, legacyUserStorageKey, skills, storageKey]);

  useEffect(() => {
    if (!hasRestored || !agentHandoff || appliedHandoffId.current === agentHandoff.id) return;
    appliedHandoffId.current = agentHandoff.id;
    const generatedPlan = agentHandoff.generatedPlan;
    const rationale = generatedPlan?.rationale || (agentHandoff.locale === "zh"
      ? "这道练习由 Agent 根据你的目标和卡点选择。"
      : "The Agent selected this practice from your goal and stuck points.");
    const projectSkills = projectSkillsForHandoff(agentHandoff);
    const primarySkill = projectSkills[0] ?? {
      id: "project-focus",
      name: agentHandoff.title,
      mastery: 0.3,
      retention: 0.3,
      expression: 0.3,
      confidence: 0.3,
    };
    const launchCards = projectCardsForHandoff(agentHandoff, projectSkills, rationale);
    const launchCard = launchCards[0];

    setGoalProfile((profile) => ({
      ...profile,
      title: generatedPlan?.goalTitle || agentHandoff.goal,
      roleBaseline: generatedPlan?.roleBaseline ?? "",
      themes: generatedPlan?.themes ?? [agentHandoff.title],
      paceBias: generatedPlan?.paceBias ?? profile.paceBias,
      sessionMinutesMin: generatedPlan?.sessionMinutesMin ?? profile.sessionMinutesMin,
      sessionMinutesMax: generatedPlan?.sessionMinutesMax ?? profile.sessionMinutesMax,
      invitationsPerWeekMin: generatedPlan?.invitationsPerWeekMin ?? profile.invitationsPerWeekMin,
      invitationsPerWeekMax: generatedPlan?.invitationsPerWeekMax ?? profile.invitationsPerWeekMax,
      studyPattern: generatedPlan?.studyPattern ?? profile.studyPattern,
      energyWindow: generatedPlan?.energyWindow ?? profile.energyWindow,
      preferredTime: generatedPlan?.preferredTime ?? profile.preferredTime,
      reminderOptIn: generatedPlan?.reminderOptIn ?? profile.reminderOptIn,
      dailyMinutes: generatedPlan?.dailyMinutes ?? profile.dailyMinutes,
      startMode: generatedPlan?.startMode ?? profile.startMode,
      startDate: generatedPlan?.startDate ?? profile.startDate,
      timeZone: generatedPlan?.timeZone ?? profile.timeZone,
      sprintDeadline: generatedPlan?.targetDate ?? profile.sprintDeadline,
      focusSkillIds: [],
    }));
    if (restoredProjectState.current) {
      setSkills((current) => current.length > 0 ? current : (projectSkills.length ? projectSkills : [primarySkill]));
      const launchIds = new Set(launchCards.map((card) => card.id));
      setGeneratedCards((cards) => [...cards.filter((card) => !launchIds.has(card.id)), ...launchCards]);
      setCardMemory((memory) => ({ ...createInitialCardMemory(launchCards), ...memory }));
    } else {
      setSkills(projectSkills.length ? projectSkills : [primarySkill]);
      setCardMemory(createInitialCardMemory(launchCards));
      setEvidence([]);
      setGeneratedCards(launchCards);
      setGeneratedNotes({});
      setDeletedCardIds([]);
    }
    setDeletedCardIds((ids) => ids.filter((id) => !launchCards.some((card) => card.id === id)));
    setSelectedNoteId(launchCard.id);
    setSessionQueue([]);
    setWorkspaceView("learn");
    setHintDepth(0);
    setReactionMs(0);
    setAttemptOutcome(null);
    setMemoryDelta(null);
    setGapSentence("");
    setPhase(restoredProjectState.current ? "idle" : "pre");
  }, [agentHandoff, hasRestored]);

  const clearRecording = () => {
    if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    mediaRecorder.current = null;
    mediaStream.current = null;
    audioChunks.current = [];
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    setRecordingState("idle");
    setRecordingError("");
  };

  const startAttempt = () => {
    setHintDepth(0);
    setReactionMs(0);
    setAttemptOutcome(null);
    setGapSentence("");
    setMemoryDelta(null);
    clearRecording();
    attemptStartedAt.current = performance.now();
    setPhase("attempt");
  };

  const beginSession = () => {
    const ranked = rankCards(allCards, goalProfile, skills, cardMemory).map((card) => card.id);
    const queue = agentHandoff && ranked.includes(agentHandoff.id)
      ? [agentHandoff.id, ...ranked.filter((id) => id !== agentHandoff.id)]
      : ranked;
    if (queue.length === 0) return;
    setSessionQueue(queue);
    window.requestAnimationFrame(startAttempt);
  };

  const finishSession = () => {
    clearRecording();
    setSessionQueue([]);
    setPhase("post");
  };

  const advanceToNextCard = () => {
    const remaining = sessionQueue.slice(1);
    if (remaining.length === 0) {
      finishSession();
      return;
    }
    setSessionQueue(remaining);
    window.requestAnimationFrame(startAttempt);
  };

  const moveCurrentCardToEnd = () => {
    if (!currentCard || sessionQueue.length <= 1) return;
    setSessionQueue((queue) => [...queue.slice(1), queue[0]]);
    clearRecording();
    window.requestAnimationFrame(startAttempt);
  };

  const skipCurrentCard = () => {
    if (!currentCard) return;
    setCardMemory((memory) => recordSilentSkip(memory, currentCard.id));
    clearRecording();
    const remaining = sessionQueue.slice(1);
    if (remaining.length === 0) {
      setSessionQueue([]);
      setPhase("post");
      return;
    }
    setSessionQueue(remaining);
    window.requestAnimationFrame(startAttempt);
  };

  const startRecording = async () => {
    setRecordingError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingState("error");
      setRecordingError(t(
        "This browser does not support recording, but you can still complete the spoken retrieval.",
        "当前浏览器不支持录音，但你仍然可以完成口述检索。",
      ));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaStream.current = stream;
      mediaRecorder.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: recorder.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        setRecordingState("ready");
      };
      recorder.start();
      setRecordingState("recording");
    } catch {
      setRecordingState("error");
      setRecordingError(t(
        "Microphone access was not granted. You can answer aloud and the system will still record the retrieval result.",
        "没有取得麦克风权限。你可以直接口述，系统仍会记录检索结果。",
      ));
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
  };

  const commitAttempt = (outcome: "fluent" | "stuck") => {
    setAttemptOutcome(outcome);
    setReactionMs(Math.max(0, Math.round(performance.now() - attemptStartedAt.current)));
    if (recordingState === "recording") stopRecording();
    setPhase("hint-keywords");
  };

  const revealNote = (depth: 1 | 2) => {
    setHintDepth(depth);
    setPhase("note");
  };

  const generateGapCard = () => {
    if (!currentCard || !gapSentence.trim()) return;
    const cardId = `gap-${Date.now()}`;
    const noteMarkdown = locale === "zh" ? `## 刚才的卡点

${gapSentence.trim()}

## 下一次检索

先不用追求完整答案。用自己的话说明这句话缺少的概念、连接或前置知识，再回到原卡片核对。` : `## Where you got stuck

${gapSentence.trim()}

## Next retrieval

Do not aim for a complete answer yet. Explain the missing concept, connection, or prerequisite in your own words, then check it against the original card.`;

    const gapCard: NoteCard = {
      id: cardId,
      skillId: currentCard.skillId,
      tags: [...new Set([...(currentCard.tags ?? []), "gap-card"])],
      mode: "recall",
      title: t(`Gap repair: ${currentCard.title}`, `补漏：${currentCard.title}`),
      prompt: t(
        `Without looking at the original note, explain the sentence that stopped you last time: ${gapSentence.trim()}`,
        `不看原笔记，解释你上次卡住的这一句：${gapSentence.trim()}`,
      ),
      hintKeywords: locale === "zh" ? ["缺失概念", "连接关系", "自己的例子"] : ["missing concept", "connection", "your own example"],
      scaffold: locale === "zh"
        ? ["先指出你不确定的名词或关系。", "补上它依赖的最小前置知识。", "用一个自己的例子重新说一遍。"]
        : ["Name the term or relationship you are unsure about.", "Add the smallest prerequisite it depends on.", "Restate it with an example of your own."],
      noteMarkdown,
      goalRelevance: currentCard.goalRelevance,
      dependencyValue: Math.min(1, currentCard.dependencyValue + 0.05),
      uncertainty: 0.9,
    };

    setGeneratedCards((cards) => [...cards, gapCard]);
    setCardMemory((memory) => ({
      ...memory,
      [cardId]: {
        intervalScale: 1,
        skipCount: 0,
        needsSplit: false,
        prerequisiteNeeded: false,
      },
    }));
    setGeneratedNotes((notes) => ({
      ...notes,
      [currentCard.id]: locale === "zh" ? `## 已生成补漏卡

**卡点：** ${gapSentence.trim()}

这不是一项欠债。它已作为一张独立卡片回到调度池，系统会在合适的时候重新检索。` : `## Gap-repair card created

**Sticking point:** ${gapSentence.trim()}

This is not a debt. It has returned to the scheduling pool as an independent card and will be retrieved again at the right time.`,
    }));
  };

  const syncAgentFeedback = async (card: NoteCard, feedback: MemoryFeedback, delta: MemoryDelta) => {
    if (!agentHandoff?.continuationToken || !card.tags?.includes("agent-selected")) return;
    setAgentSyncStage("running");
    setRhythmRevision(null);

    try {
      const response = await fetch("/api/hackathon-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-noteflow-locale": locale },
        body: JSON.stringify({
          action: "feedback",
          locale,
          continuationToken: agentHandoff.continuationToken,
          practice: {
            cardTitle: card.title,
            prompt: card.prompt,
            attemptOutcome: attemptOutcome ?? "stuck",
            feedback,
            hintDepth,
            reactionMs,
            memoryBefore: Math.round(delta.before * 100),
            memoryAfter: Math.round(delta.after * 100),
          },
        }),
      });
      const payload = (await response.json()) as { events?: unknown; error?: string };
      if (!response.ok) throw new Error(payload.error || `Agent feedback failed (${response.status}).`);
      const report = extractAgentText(payload.events, "");
      if (!report) throw new Error("The Agent returned no rhythm update.");
      const revision: RhythmRevision = {
        before: agentHandoff.rhythmPlan || t("Initial rhythm from the planning run", "规划阶段生成的初始节奏"),
        after: extractAgentSection(report, ["rhythm plan", "学习节奏"]) || report,
        nextInvitation: extractAgentSection(report, ["next invitation", "下次邀请"]),
        agentReport: report,
        updatedAt: new Date().toISOString(),
      };
      setRhythmRevision(revision);
      window.localStorage.setItem(latestRhythmKey, JSON.stringify(revision));
      setAgentSyncStage("complete");
    } catch {
      setAgentSyncStage("error");
    }
  };

  const submitFeedback = (feedback: MemoryFeedback) => {
    if (!currentCard) return;
    const result = applyMemoryFeedback(skills, currentCard, feedback, hintDepth);
    setSkills(result.skills);
    setMemoryDelta(result.delta);
    setCardMemory((memory) => updateCardMemory(memory, currentCard.id, feedback));
    setEvidence((items) => [
      ...items,
      {
        cardId: currentCard.id,
        attemptOutcome: attemptOutcome ?? "stuck",
        feedback,
        hintDepth,
        reactionMs,
        recordedAt: new Date().toISOString(),
      },
    ]);
    void syncAgentFeedback(currentCard, feedback, result.delta);

    let prerequisiteId = currentCard.prerequisiteCardId;

    if (feedback === "prerequisite" && !prerequisiteId) {
      const fallbackPrerequisite = buildPrerequisiteCard(currentCard, locale);
      prerequisiteId = fallbackPrerequisite.id;

      if (!allCards.some((card) => card.id === fallbackPrerequisite.id)) {
        setGeneratedCards((cards) => [...cards, fallbackPrerequisite]);
        setCardMemory((memory) => ({
          ...memory,
          [fallbackPrerequisite.id]: {
            intervalScale: 1,
            skipCount: 0,
            needsSplit: false,
            prerequisiteNeeded: false,
          },
        }));
      }
    }

    if (feedback === "prerequisite" && prerequisiteId) {
      setSessionQueue((queue) => {
        const withoutPrerequisite = queue.slice(1).filter((id) => id !== prerequisiteId);
        return [queue[0], prerequisiteId, ...withoutPrerequisite];
      });
    }
    setPhase("delta");
  };

  const editCard = (
    cardId: string,
    patch: Partial<
      Pick<NoteCard, "title" | "prompt" | "noteMarkdown" | "skillId" | "tags" | "mode">
    >,
  ) => {
    if (patch.noteMarkdown !== undefined) {
      setGeneratedNotes((notes) => ({ ...notes, [cardId]: patch.noteMarkdown ?? "" }));
    }

    const structuralPatch = { ...patch };
    delete structuralPatch.noteMarkdown;
    if (Object.keys(structuralPatch).length === 0) return;

    setGeneratedCards((cards) => {
      const existing = cards.find((card) => card.id === cardId);
      if (existing) {
        return cards.map((card) => (card.id === cardId ? { ...card, ...structuralPatch } : card));
      }

      const source = noteCards.find((card) => card.id === cardId);
      return source ? [...cards, { ...source, ...structuralPatch }] : cards;
    });
  };

  const createNote = () => {
    const cardId = `note-${Date.now()}`;
    const skillId = goalProfile.focusSkillIds[0] ?? skills[0]?.id ?? "general";
    const card: NoteCard = {
      id: cardId,
      skillId,
      tags: activeProjectTag ? [skillId, activeProjectTag] : [skillId],
      mode: "recall",
      title: t("Untitled note", "未命名笔记"),
      prompt: t("Without looking at the note, explain its core concept in your own words.", "不看笔记，用自己的话解释这条知识的核心概念。"),
      hintKeywords: locale === "zh" ? ["核心概念", "为什么", "例子"] : ["core concept", "why", "example"],
      scaffold: locale === "zh"
        ? ["先给出定义。", "再说明它解决什么问题。", "最后给一个自己的例子。"]
        : ["Start with a definition.", "Explain the problem it solves.", "Finish with an example of your own."],
      noteMarkdown: "",
      goalRelevance: 0.65,
      dependencyValue: 0.5,
      uncertainty: 0.8,
    };

    setGeneratedCards((cards) => [...cards, card]);
    setCardMemory((memory) => ({
      ...memory,
      [cardId]: {
        intervalScale: 1,
        skipCount: 0,
        needsSplit: false,
        prerequisiteNeeded: false,
      },
    }));
    setSelectedNoteId(cardId);
    setWorkspaceView("notes");
  };

  const bulkEditCards = (
    cardIds: string[],
    patch: Partial<Pick<NoteCard, "skillId" | "tags" | "mode">>,
  ) => {
    const ids = new Set(cardIds);
    setGeneratedCards((cards) => {
      const edits = new Map(cards.map((card) => [card.id, card]));
      allCards
        .filter((card) => ids.has(card.id))
        .forEach((card) => edits.set(card.id, { ...card, ...patch }));
      return [...edits.values()];
    });
  };

  const bulkAddTag = (cardIds: string[], tag: string) => {
    const ids = new Set(cardIds);
    setGeneratedCards((cards) => {
      const edits = new Map(cards.map((card) => [card.id, card]));
      allCards
        .filter((card) => ids.has(card.id))
        .forEach((card) =>
          edits.set(card.id, {
            ...card,
            tags: [...new Set([...(card.tags ?? []), tag])],
          }),
        );
      return [...edits.values()];
    });
  };

  const importCards = (cardsToImport: NoteCard[]) => {
    if (cardsToImport.length === 0) return;

    setGeneratedCards((cards) => {
      const merged = new Map(cards.map((card) => [card.id, card]));
      cardsToImport.forEach((card) => merged.set(card.id, {
        ...card,
        skillId: skills.some((skill) => skill.id === card.skillId) ? card.skillId : (skills[0]?.id ?? card.skillId),
        tags: [...new Set([...(card.tags ?? []), ...(activeProjectTag ? [activeProjectTag] : [])])],
      }));
      return [...merged.values()];
    });
    setDeletedCardIds((ids) => ids.filter((id) => !cardsToImport.some((card) => card.id === id)));
    setCardMemory((memory) => ({
      ...createInitialCardMemory(cardsToImport),
      ...memory,
    }));
    setSelectedNoteId(cardsToImport[0].id);
  };

  const deleteCards = (cardIds: string[]) => {
    const removed = new Set(cardIds);
    setDeletedCardIds((ids) => [...new Set([...ids, ...cardIds])]);
    setGeneratedCards((cards) => cards.filter((card) => !removed.has(card.id)));
    setGeneratedNotes((notes) =>
      Object.fromEntries(Object.entries(notes).filter(([id]) => !removed.has(id))),
    );
    setCardMemory((memory) =>
      Object.fromEntries(Object.entries(memory).filter(([id]) => !removed.has(id))),
    );
    setEvidence((items) => items.filter((item) => !removed.has(item.cardId)));
    setSessionQueue((queue) => queue.filter((id) => !removed.has(id)));

    if (removed.has(selectedNoteId)) {
      setSelectedNoteId(allCards.find((card) => !removed.has(card.id))?.id ?? "");
    }
  };

  const openLearning = () => {
    clearRecording();
    setSessionQueue([]);
    setPhase((current) => current === "pre" ? "pre" : agentHandoff ? "idle" : "pre");
    setWorkspaceView("learn");
  };

  const resetMemory = () => {
    clearRecording();
    if (agentHandoff) {
      setSkills(projectSkillsForHandoff(agentHandoff));
    } else {
      setGoalProfile(defaultGoalProfile);
      setSkills(initialSkills);
    }
    setCardMemory(createInitialCardMemory(allCards));
    setEvidence([]);
    setSessionQueue([]);
    setPhase(agentHandoff ? "idle" : "pre");
  };

  const downloadCalendarInvitation = () => {
    const startsAt = planStartDate(goalProfile);
    if (!startsAt) {
      setReminderStatus(t(
        "Confirm a start date and time before creating a calendar event.",
        "请先确认开始日期和时间，再创建日历事件。",
      ));
      return;
    }
    const endsAt = new Date(startsAt.getTime() + goalProfile.sessionMinutesMax * 60_000);
    const title = "NoteFlow · " + goalProfile.title;
    const dailyBudget = goalProfile.dailyMinutes
      ? t("Daily budget: ", "每日预算：") + goalProfile.dailyMinutes + " min. "
      : "";
    const description = dailyBudget + t(
      "Suggested session range: ",
      "建议单次范围：",
    ) + goalProfile.sessionMinutesMin + "–" + goalProfile.sessionMinutesMax + " min. " + t(
      "Open NoteFlow for one retrieval; stopping after it is allowed.",
      "打开 NoteFlow 完成一次检索；做完即可停止。",
    );
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//NoteFlow//Learning Project//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:noteflow-" + Date.now() + "@noteflow",
      "DTSTAMP:" + formatIcsDate(new Date()),
      "DTSTART:" + formatIcsDate(startsAt),
      "DTEND:" + formatIcsDate(endsAt),
      "SUMMARY:" + title,
      "DESCRIPTION:" + description,
      "BEGIN:VALARM",
      "TRIGGER:-PT10M",
      "ACTION:DISPLAY",
      "DESCRIPTION:" + title,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "noteflow-learning-project.ics";
    link.click();
    URL.revokeObjectURL(url);
    setReminderStatus(t("Calendar event downloaded.", "日历事件已下载。"));
  };

  const enableBrowserReminder = async () => {
    const startsAt = planStartDate(goalProfile);
    if (!startsAt) {
      setReminderStatus(t(
        "Confirm a start date and time before enabling a reminder.",
        "请先确认开始日期和时间，再开启提醒。",
      ));
      return;
    }
    if (!("Notification" in window)) {
      setReminderStatus(t("This browser does not support notifications. Use the calendar event instead.", "当前浏览器不支持通知，请改用日历事件。"));
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setReminderStatus(t("Notification permission was not enabled.", "未开启通知权限。"));
      return;
    }
    window.localStorage.setItem("noteflow-next-reminder-v1", JSON.stringify({
      at: startsAt.toISOString(),
      project: goalProfile.title,
      sessionMinutesMin: goalProfile.sessionMinutesMin,
      sessionMinutesMax: goalProfile.sessionMinutesMax,
    }));
    if (reminderTimer.current) window.clearTimeout(reminderTimer.current);
    const delay = Math.max(0, startsAt.getTime() - Date.now());
    if (delay <= 2_147_483_647) {
      reminderTimer.current = window.setTimeout(() => {
        new Notification(t("Your NoteFlow learning time is here", "你的 NoteFlow 学习时间到了"), {
          body: t("Open one retrieval. There is no overdue work.", "只做一次检索，没有逾期任务。"),
        });
      }, delay);
    }
    setReminderStatus(t(
      "Browser reminder enabled while this browser remains available. Calendar export is more durable.",
      "浏览器提醒已开启；日历事件在关闭页面后更可靠。",
    ));
  };

  const noteSource = currentCard?.noteMarkdown ?? "";
  const scheduleConfirmed = Boolean(planStartDate(goalProfile));

  return (
    <main className={`app-shell phase-${phase}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand-zone">
          <button className="brand" type="button" onClick={() => setWorkspaceView("learn")} aria-label="NoteFlow">
            <span className="brand-mark" aria-hidden="true">N</span>
            <span>NoteFlow</span>
          </button>
          {(phase === "pre" || phase === "idle" || phase === "post") && (
            <nav className="workspace-nav" aria-label={t("Workspace", "工作区")}>
              <button
                type="button"
                className={workspaceView === "notes" ? "selected" : ""}
                onClick={() => setWorkspaceView("notes")}
              >
                {t("Notes", "笔记库")}
              </button>
              <button
                type="button"
                className={workspaceView === "learn" ? "selected" : ""}
                onClick={openLearning}
              >
                {t("Learn", "学习")}
              </button>
            </nav>
          )}
        </div>

        {phase !== "pre" && phase !== "idle" && phase !== "post" ? (
          <div className="active-header">
            {agentHandoff
              ? <span className="content-language-badge">{agentHandoff.locale === "zh" ? "中文内容" : "English content"}</span>
              : <LanguageSwitch />}
            <span>{t("Retrieval in progress", "检索中")}</span>
            <button className="quiet-button" type="button" onClick={finishSession}>{t("End this session", "结束本次学习")}</button>
          </div>
        ) : (
          <div className="header-tools">
            {agentHandoff
              ? <span className="content-language-badge">{agentHandoff.locale === "zh" ? "中文内容" : "English content"}</span>
              : <LanguageSwitch />}
            <div className="data-status">
              <i />
              <span>{isGuest ? t("Guest demo · saved in this browser", "访客演示 · 保存在当前浏览器") : t("Private workspace · saved to the cloud", "个人空间 · 云端自动保存")}</span>
              {phase === "post" && workspaceView === "learn" && (
                <button className="quiet-button" type="button" onClick={resetMemory}>{t("Reset learning data", "重置学习数据")}</button>
              )}
            </div>
            <div className="account-pill">
              <span className="account-avatar" aria-hidden="true">
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="account-copy">
                <strong>{user.displayName}</strong>
                <small>
                  {isGuest
                    ? t("No sign-in required", "无需登录")
                    : user.authProvider === "google"
                      ? `Google · ${user.email}`
                      : user.email}
                </small>
              </span>
              {isGuest ? (
                <a className="account-signout" href="/hackathon">{t("Entry page", "参赛页")}</a>
              ) : (
                <button
                  className="account-signout"
                  type="button"
                  onClick={() => void onSignOut()}
                >
                  {t("Sign out", "退出")}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {(phase === "pre" || phase === "idle" || phase === "post") && workspaceView === "notes" && (
        <NoteLibrary
          cards={allCards}
          skills={skills}
          selectedId={selectedNoteId}
          onSelect={setSelectedNoteId}
          onCreate={createNote}
          onChange={editCard}
          onBulkChange={bulkEditCards}
          onBulkAddTag={bulkAddTag}
          onDelete={deleteCards}
          onImport={importCards}
          onLearn={openLearning}
        />
      )}

      {phase === "pre" && workspaceView === "learn" && (
        <section className="pre-session">
          <div className="pre-copy">
            <p className="eyebrow">{agentHandoff
              ? t("Plan ready · review before the session", "计划已生成 · Session 前先确认")
              : t("System handles the decision. You handle retrieval.", "系统负责决策，你负责检索。")}</p>
            <h1>{agentHandoff
              ? <>{t("The Agent proposed the structure.", "Agent 已经生成结构。")}<br />{t("You choose when learning starts.", "由你决定何时开始学习。")}</>
              : <>{t("Do not plan.", "不用计划。")}<br />{t("When you are ready, do only the card in front of you.", "准备好以后，只做眼前这一张。")}</>}</h1>
            <p>
              {agentHandoff
                ? t(
                    "Adjust the generated ranges if needed. They guide priority, study reminders, and a suggested stopping point—not how often you are allowed to learn.",
                    "如有需要，可以调整 Agent 生成的范围。它们只指导优先级、学习提醒和建议停止点，不限制你可以学习多少次。",
                  )
                : t(
                    "NoteFlow does not show to-do lists, debts, or completion rates. Cards you miss return naturally to the scheduling pool and compete for the next retrieval opportunity like every other piece of knowledge.",
                    "NoteFlow 不展示待办、欠账或完成率。没做到的卡会自然回到调度池，和所有知识一样重新竞争下一次检索机会。",
                  )}
            </p>
            <GoalPlanner
              profile={goalProfile}
              skills={skills}
              onChange={setGoalProfile}
              agentGenerated={Boolean(agentHandoff)}
            />
            <button className="primary-button start-session-button" type="button" onClick={() => setPhase("idle")}>
              {t("Confirm this plan", "确认学习计划")}
              <span aria-hidden="true">→</span>
            </button>
          </div>
          {agentHandoff
            ? <AgentPlanPreview handoff={agentHandoff} onOpenNotes={() => setWorkspaceView("notes")} />
            : <SkillStateView skills={skills} eyebrow={t("Before session", "Session 前")} title={t("Current skill state", "当前能力状态")} isGuest={isGuest} />}
        </section>
      )}

      {phase === "idle" && workspaceView === "learn" && (
        <section className="idle-session">
          <div className="idle-copy">
            <p className="eyebrow">{t("Plan set · start when you are ready", "计划已设置 · 准备好再开始")}</p>
            <h1>{goalProfile.title}</h1>
            <p>{t(
              "Your notes and Agent-generated retrieval cards are ready. Start now, return to Notes, or adjust the plan—nothing becomes overdue while you wait.",
              "笔记和 Agent 生成的检索卡都已准备好。你可以现在开始、回到笔记库补充资料，或继续调整计划；等待期间不会产生逾期任务。",
            )}</p>
            <div className="idle-plan-summary">
              <div><span>{t("Session range", "单次范围")}</span><strong>{goalProfile.sessionMinutesMin}–{goalProfile.sessionMinutesMax} min</strong></div>
              <div><span>{t("Retrieval cards", "检索卡片")}</span><strong>{allCards.length}</strong></div>
              <div><span>{t("Start", "开始时间")}</span><strong>{scheduleConfirmed ? t("Confirmed", "已确认") : t("Not decided", "尚未确定")}</strong></div>
            </div>
            <div className="idle-actions">
              <button className="primary-button" type="button" onClick={beginSession}>
                {t("Start learning", "开始学习")}
                <span aria-hidden="true">→</span>
              </button>
              <button className="secondary-button" type="button" onClick={() => setPhase("pre")}>
                {t("Adjust plan", "调整计划")}
              </button>
            </div>
            <div className="idle-schedule-actions">
              <div>
                <span>{t("Calendar and reminders", "日历与提醒")}</span>
                <p>{scheduleConfirmed
                  ? t("Export the confirmed session range or enable the optional browser reminder.", "导出已经确认的学习时间段，或开启可选的浏览器提醒。")
                  : t("Choose a start time in Adjust plan before exporting a calendar event or enabling a reminder.", "请先在“调整计划”中确定开始时间，再导出日历事件或开启提醒。")}</p>
              </div>
              {scheduleConfirmed && (
                <div className="plan-reminder-actions">
                  <button type="button" onClick={downloadCalendarInvitation}>{t("Add to calendar", "添加到日历")}</button>
                  {goalProfile.reminderOptIn && (
                    <button type="button" onClick={() => void enableBrowserReminder()}>{t("Enable browser reminder", "开启浏览器提醒")}</button>
                  )}
                </div>
              )}
            </div>
            {reminderStatus && <p className="plan-reminder-status">{reminderStatus}</p>}
          </div>
          <SkillStateView skills={skills} eyebrow={t("Current project", "当前项目")} title={t("Current skill state", "当前能力状态")} isGuest={isGuest} />
        </section>
      )}

      {phase === "post" && workspaceView === "learn" && (
        <section className="post-session">
          <div className="post-copy">
            <span className="post-mark" aria-hidden="true">✓</span>
            <p className="eyebrow">{t("Session complete", "Session 已收束")}</p>
            <h1>{t("There is no unfinished work.", "没有“没做完”。")}</h1>
            <p>{t(
              "Cards that did not appear have returned to the memory scheduling pool. They are not a backlog and will not become a debt tomorrow.",
              "刚才没有出现的卡已经回到记忆调度池。它们不是 backlog，也不会在明天变成欠债。",
            )}</p>
            {rhythmRevision && (
              <div className="agent-rhythm-sync compact">
                <p className="eyebrow">{t("Agent revised the next rhythm", "Agent 已调整下一次节奏")}</p>
                <strong>{rhythmRevision.nextInvitation || t("The next study reminder follows the revised rhythm.", "下次学习提醒将按照新节奏出现。")}</strong>
              </div>
            )}
            <button className="primary-button" type="button" onClick={() => setPhase("idle")}>
              {t("Back to the plan", "回到计划")}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <SkillStateView skills={skills} eyebrow={t("After session", "Session 后")} title={t("Updated skill state", "更新后的能力状态")} isGuest={isGuest} />
        </section>
      )}

      {phase !== "pre" && phase !== "idle" && phase !== "post" && currentCard && (
        <section className="retrieval-space">
          <article className={`memory-card card-${phase}`}>
            <div className="card-chrome">
              <div>
                <span className="side-dot" />
                <span>{phase === "note" ? t("Note back", "笔记背面") : t("Retrieval front", "检索正面")}</span>
              </div>
              <span>{currentCard.mode}</span>
            </div>

            {phase === "attempt" && (
              <div className="attempt-view">
                <p className="eyebrow">{t("Generate first, then verify", "先生成，再核对")}</p>
                <h1>{currentCard.title}</h1>
                <div className="prompt-block"><p>{currentCard.prompt}</p></div>

                {currentCard.mode === "speak" && (
                  <div className="recording-box">
                    <div>
                      <strong>{t("Spoken recording", "口述录音")}</strong>
                      <span>{t("The recording stays only in this retrieval", "录音只保留在当前检索中")}</span>
                    </div>
                    {recordingState === "idle" && (
                      <button type="button" onClick={startRecording}>
                        <i className="record-dot" /> {t("Start recording", "开始录音")}
                      </button>
                    )}
                    {recordingState === "recording" && (
                      <button className="recording" type="button" onClick={stopRecording}>
                        <i className="record-dot" /> {t("Stop recording", "停止录音")}
                      </button>
                    )}
                    {recordingState === "ready" && audioUrl && (
                      <audio controls src={audioUrl} aria-label={t("Recording for this retrieval", "本次口述录音")} />
                    )}
                    {recordingState === "error" && <p className="recording-error">{recordingError}</p>}
                  </div>
                )}

                <div className="attempt-actions">
                  <button className="primary-button" type="button" onClick={() => commitAttempt("fluent")}>
                    {t("I explained it clearly", "说顺了")}
                    <span aria-hidden="true">→</span>
                  </button>
                  <button className="secondary-button" type="button" onClick={() => commitAttempt("stuck")}>{t("I got stuck", "卡住了")}</button>
                </div>
                <div className="defer-actions">
                  <button className="queue-end-button" type="button" onClick={moveCurrentCardToEnd} disabled={sessionQueue.length <= 1}>
                    {t("Later this session · move to queue end", "本次稍后再做 · 放在队末")}
                  </button>
                  <button className="skip-button" type="button" onClick={skipCurrentCard}>
                    {t("Skip for now · return to learning pool", "暂时跳过 · 回到学习池")}
                  </button>
                </div>
                {sessionQueue.length <= 1 && (
                  <p className="queue-end-note">{t(
                    "There is no later position because this session has one card. Skip for now ends this session and returns the card to the pool.",
                    "本次只有这一张卡，所以没有更后的队位；“暂时跳过”会结束本次 Session，并把卡放回学习池。",
                  )}</p>
                )}
              </div>
            )}

            {phase === "hint-keywords" && (
              <div className="hint-view">
                <p className="eyebrow">{t("A little structure, without the answer", "先给一点结构，不给答案")}</p>
                <h1>{t("Try again with these words.", "用这几个词，再试一次。")}</h1>
                <div className="keyword-cloud">
                  {currentCard.hintKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
                </div>
                <p className="hint-prompt">{t("Say the answer again. Can you connect these words?", "把答案重新说一遍。能把这些词连起来吗？")}</p>
                <div className="hint-actions">
                  <button className="primary-button" type="button" onClick={() => revealNote(1)}>
                    {t("I remember now · check the note", "想起来了，核对笔记")}
                    <span aria-hidden="true">→</span>
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setPhase("hint-scaffold")}>
                    {t("Give me another hint", "再给一点提示")}
                  </button>
                </div>
              </div>
            )}

            {phase === "hint-scaffold" && (
              <div className="hint-view scaffold-view">
                <p className="eyebrow">{t("More structure, still without the answer", "再多一点骨架，仍然不给答案")}</p>
                <h1>{t("Follow this order and try again.", "沿着这个顺序，再说一次。")}</h1>
                <div className="scaffold-list">
                  {currentCard.scaffold.map((line) => (
                    <div key={line}>
                      <span aria-hidden="true" />
                      <p>{line}</p>
                    </div>
                  ))}
                </div>
                <div className="hint-actions">
                  <button className="primary-button" type="button" onClick={() => revealNote(2)}>
                    {t("I remember now · check the note", "想起来了，核对笔记")}
                    <span aria-hidden="true">→</span>
                  </button>
                  <button className="secondary-button" type="button" onClick={() => revealNote(2)}>
                    {t("Still stuck · show the answer", "还是不行，给我答案")}
                  </button>
                </div>
              </div>
            )}

            {phase === "note" && (
              <div className="note-view">
                <div className="note-heading">
                  <div>
                    <p className="eyebrow">{t("Same card · Markdown back", "同一张卡 · Markdown 背面")}</p>
                    <h1>{currentCard.title}</h1>
                  </div>
                  <span>{t("Read freely · no timer", "自由阅读 · 不计时")}</span>
                </div>

                {noteSource ? (
                  <MarkdownNote source={noteSource} />
                ) : (
                  <div className="empty-note">
                    <p className="eyebrow">{t("This card still has an empty back", "这张卡的背面还是空的")}</p>
                    <h2>{t("Which sentence stopped you?", "刚才卡在哪一句？")}</h2>
                    <p>{t(
                      "Write the most specific break point. NoteFlow will turn it into a smaller gap-repair card, not a debt.",
                      "写下最具体的断点。NoteFlow 会把它变成一张更小的补漏卡，而不是一项欠债。",
                    )}</p>
                    <label>
                      <span className="sr-only">{t("The sentence that stopped you", "刚才卡住的句子")}</span>
                      <textarea
                        value={gapSentence}
                        onChange={(event) => setGapSentence(event.target.value)}
                        placeholder={t("e.g. I know I need Strategy, but cannot explain what the Dispatcher should depend on.", "例如：我知道要用 Strategy，但说不清 Dispatcher 应该依赖谁。")}
                      />
                    </label>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={generateGapCard}
                      disabled={!gapSentence.trim()}
                    >
                      {t("Create gap-repair card", "生成补漏卡")}
                      <span aria-hidden="true">＋</span>
                    </button>
                  </div>
                )}

                {(noteSource || generatedNotes[currentCard.id]) && (
                  <div className="note-actions">
                    <button className="primary-button" type="button" onClick={() => setPhase("feedback")}>
                      {t("Finished reading", "读完了")}
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {phase === "feedback" && (
              <div className="feedback-view">
                <p className="eyebrow">{t("This is not a score—only a signal to the scheduler", "这不是打分，只是给调度器一个信号")}</p>
                <h1>{t("What just happened?", "刚才是哪一种情况？")}</h1>
                <div className="feedback-options">
                  <button type="button" onClick={() => submitFeedback("guided")}>
                    <span className="feedback-mark">↻</span>
                    <span>
                      <strong>{t("I could not recall it, but knew what I was looking for", "想不起来，但知道在找什么")}</strong>
                      <small>{t("Reschedule normally and let it return later", "正常重排，之后自然再来")}</small>
                    </span>
                    <b aria-hidden="true">→</b>
                  </button>
                  <button type="button" onClick={() => submitFeedback("prerequisite")}>
                    <span className="feedback-mark">↙</span>
                    <span>
                      <strong>{t("I had no direction", "完全没方向")}</strong>
                      <small>{t("Step back to a prerequisite first", "先退到前置知识")}</small>
                    </span>
                    <b aria-hidden="true">→</b>
                  </button>
                  <button type="button" onClick={() => submitFeedback("overlearned")}>
                    <span className="feedback-mark">↗</span>
                    <span>
                      <strong>{t("This was too familiar", "太熟了")}</strong>
                      <small>{t("Extend the interval so it appears less often", "拉长间隔，以后少出现")}</small>
                    </span>
                    <b aria-hidden="true">→</b>
                  </button>
                </div>
              </div>
            )}

            {phase === "delta" && memoryDelta && (
              <div className="delta-view">
                <span className="delta-spark" aria-hidden="true">✦</span>
                <p className="eyebrow">{t("The retrieval result is now in the memory model", "检索结果已经写回记忆模型")}</p>
                <h1>{memoryDelta.skillName}</h1>
                <div className="delta-number">
                  <span>{Math.round(memoryDelta.before * 100)}%</span>
                  <b aria-hidden="true">→</b>
                  <strong>{Math.round(memoryDelta.after * 100)}%</strong>
                </div>
                <p className="delta-label">
                  {memoryDelta.metric === "expression" ? t("Expression recall", "表达可提取性") : t("Memory retention", "记忆保持度")}
                </p>
                <p className="delta-message">{locale === "zh"
                  ? memoryDelta.message === "Interval expanded. This card will appear less often."
                    ? "间隔已经拉长，这张卡以后会更少出现。"
                    : memoryDelta.message === "A prerequisite will be retrieved before this card returns."
                      ? "在这张卡再次出现之前，系统会先检索一张前置卡。"
                      : "这张卡已回到正常的记忆调度中。"
                  : memoryDelta.message}</p>
                {agentSyncStage !== "idle" && (
                  <div className={`agent-rhythm-sync ${agentSyncStage}`} aria-live="polite">
                    {agentSyncStage === "running" && (
                      <>
                        <p className="eyebrow">{t("Feedback returned to the Google Agent", "练习反馈已回传 Google Agent")}</p>
                        <strong>{t("Revising the next rhythm…", "正在调整下一次学习节奏…")}</strong>
                      </>
                    )}
                    {agentSyncStage === "error" && (
                      <>
                        <p className="eyebrow">{t("Local memory updated", "本地记忆已更新")}</p>
                        <strong>{t("The cloud rhythm could not be revised this time.", "这一次未能同步调整云端节奏。")}</strong>
                      </>
                    )}
                    {agentSyncStage === "complete" && rhythmRevision && (
                      <>
                        <p className="eyebrow">{t("Visible plan mutation", "可见的计划变化")}</p>
                        <div className="rhythm-comparison">
                          <div>
                            <span>{t("Before practice", "练习前")}</span>
                            <p>{rhythmRevision.before}</p>
                          </div>
                          <b aria-hidden="true">→</b>
                          <div>
                            <span>{t("After this evidence", "根据本次证据调整后")}</span>
                            <p>{rhythmRevision.after}</p>
                          </div>
                        </div>
                        {rhythmRevision.nextInvitation && (
                          <div className="next-invitation">
                            <span>{t("Next study reminder", "下次学习提醒")}</span>
                            <strong>{rhythmRevision.nextInvitation}</strong>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                <div className="delta-actions">
                  <button className="primary-button" type="button" onClick={advanceToNextCard}>
                    {t("Next card", "下一张")}
                    <span aria-hidden="true">→</span>
                  </button>
                  <button className="secondary-button" type="button" onClick={finishSession}>{t("Stop here", "到这里")}</button>
                </div>
                <p className="continuation-note">{t("Whether you continue does not affect scheduling weight.", "是否继续不会进入调度权重。")}</p>
              </div>
            )}
          </article>
        </section>
      )}
    </main>
  );
}
