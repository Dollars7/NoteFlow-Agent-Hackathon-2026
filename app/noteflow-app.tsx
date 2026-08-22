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
  type GoalId,
  type GoalProfile,
  type MemoryDelta,
  type MemoryFeedback,
  type NoteCard,
  type RetrievalEvidence,
  type SkillState,
} from "../lib/flow-engine";
import type { HackathonHandoff } from "../lib/hackathon-handoff";
import { GoalPlanner } from "./goal-planner";
import { LanguageSwitch, useLocale, type Locale } from "./locale";
import { NoteLibrary } from "./note-library";

type Phase =
  | "pre"
  | "attempt"
  | "hint-keywords"
  | "hint-scaffold"
  | "note"
  | "feedback"
  | "delta"
  | "post";

type StoredMemory = {
  goalProfile: GoalProfile;
  goal?: GoalId;
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
}: {
  skills: SkillState[];
  title: string;
  eyebrow: string;
}) {
  const { locale, t } = useLocale();

  return (
    <section className="skill-state-card">
      <div className="state-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span className="local-pill"><i /> {t("Saved to your private space", "保存到私人空间")}</span>
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

export default function NoteFlowApp({
  user,
  getAccessToken,
  onSignOut,
  isGuest = false,
  agentHandoff = null,
}: NoteFlowAppProps) {
  const { locale, t } = useLocale();
  const storageKey = `noteflow-memory-v4:${user.id}`;
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

  const attemptStartedAt = useRef(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const appliedHandoffId = useRef<string | null>(null);

  const allCards = useMemo(() => {
    const edits = new Map(generatedCards.map((card) => [card.id, card]));
    const baseIds = new Set(noteCards.map((card) => card.id));
    const merged = [
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
  }, [deletedCardIds, generatedCards, generatedNotes]);
  const currentCard = allCards.find((card) => card.id === sessionQueue[0]);

  useEffect(() => {
    const applyStored = (parsed: StoredMemory) => {
      setGoalProfile(
        parsed.goalProfile ?? {
          ...defaultGoalProfile,
          baseGoal: parsed.goal ?? defaultGoalProfile.baseGoal,
        },
      );
      setSkills(parsed.skills ?? initialSkills);
      setCardMemory({
        ...createInitialCardMemory([...noteCards, ...(parsed.generatedCards ?? [])]),
        ...(parsed.cardMemory ?? {}),
      });
      setEvidence(parsed.evidence ?? []);
      setGeneratedCards(
        (parsed.generatedCards ?? []).map((card) => ({
          ...card,
          tags: card.tags ?? [card.skillId],
        })),
      );
      setGeneratedNotes(parsed.generatedNotes ?? {});
      setDeletedCardIds(parsed.deletedCardIds ?? []);
    };

    const restoreFrame = window.requestAnimationFrame(() => {
      void (async () => {
        let parsed: StoredMemory | null = null;

        try {
          const accessToken = await getAccessToken();
          if (accessToken) {
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
            const saved =
              window.localStorage.getItem(storageKey) ??
              window.localStorage.getItem(legacyAccountStorageKey) ??
              window.localStorage.getItem(legacyStorageKey);
            if (saved) parsed = JSON.parse(saved) as StoredMemory;
          } catch {
            window.localStorage.removeItem(storageKey);
            window.localStorage.removeItem(legacyAccountStorageKey);
            window.localStorage.removeItem(legacyStorageKey);
          }
        }

        if (parsed) applyStored(parsed);
        setHasRestored(true);
      })();
    });

    return () => window.cancelAnimationFrame(restoreFrame);
  }, [getAccessToken, legacyAccountStorageKey, storageKey]);

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
      window.localStorage.removeItem(legacyAccountStorageKey);
      window.localStorage.removeItem(legacyStorageKey);
      void (async () => {
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
  }, [cardMemory, deletedCardIds, evidence, generatedCards, generatedNotes, getAccessToken, goalProfile, hasRestored, legacyAccountStorageKey, skills, storageKey]);

  useEffect(() => {
    if (!hasRestored || !agentHandoff || appliedHandoffId.current === agentHandoff.id) return;
    appliedHandoffId.current = agentHandoff.id;

    const launchCard: NoteCard = {
      id: agentHandoff.id,
      skillId: "ood",
      tags: ["agent-selected", "hackathon", "retrieval"],
      mode: "design",
      title: agentHandoff.title,
      prompt: agentHandoff.nextRetrievalPrompt,
      hintKeywords: agentHandoff.locale === "zh"
        ? ["核心权衡", "用户影响", "设计决策"]
        : ["core tradeoff", "user impact", "design decision"],
      scaffold: agentHandoff.locale === "zh"
        ? ["先说出必须保护的系统行为。", "明确你愿意放宽的保证。", "说明用户会看到什么，以及你如何缓解。"]
        : ["State the system behavior you must protect.", "Name the guarantee you are willing to relax.", "Explain what the user will observe and how you would mitigate it."],
      noteMarkdown: agentHandoff.locale === "zh"
        ? `## Agent 报告\n\n${agentHandoff.agentReport}\n\n## 原始学习证据\n\n${agentHandoff.sourceNotes}`
        : `## Agent report\n\n${agentHandoff.agentReport}\n\n## Original learning evidence\n\n${agentHandoff.sourceNotes}`,
      goalRelevance: { "amazon-sde2": 0.95, "google-l4": 0.95 },
      dependencyValue: 0.92,
      uncertainty: 0.82,
    };

    setGoalProfile((profile) => ({ ...profile, title: agentHandoff.goal }));
    setGeneratedCards((cards) => cards.some((card) => card.id === launchCard.id) ? cards : [...cards, launchCard]);
    setCardMemory((memory) => ({
      ...memory,
      [launchCard.id]: memory[launchCard.id] ?? {
        intervalScale: 1,
        skipCount: 0,
        needsSplit: false,
        prerequisiteNeeded: false,
      },
    }));
    setDeletedCardIds((ids) => ids.filter((id) => id !== launchCard.id));
    setSelectedNoteId(launchCard.id);
    setSessionQueue([launchCard.id]);
    setWorkspaceView("learn");
    setHintDepth(0);
    setReactionMs(0);
    setAttemptOutcome(null);
    setMemoryDelta(null);
    setGapSentence("");
    attemptStartedAt.current = performance.now();
    setPhase("attempt");
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
    const queue = rankCards(allCards, goalProfile, skills, cardMemory).map((card) => card.id);
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
    const nextQueue =
      remaining.length > 0
        ? remaining
        : rankCards(allCards, goalProfile, skills, cardMemory).map((card) => card.id);
    setSessionQueue(nextQueue);
    window.requestAnimationFrame(startAttempt);
  };

  const skipCurrentCard = () => {
    if (!currentCard) return;
    setCardMemory((memory) => recordSilentSkip(memory, currentCard.id));
    setSessionQueue((queue) => (queue.length > 1 ? [...queue.slice(1), queue[0]] : queue));
    clearRecording();
    attemptStartedAt.current = performance.now();
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
    const skillId = goalProfile.focusSkillIds[0] ?? "intervals";
    const card: NoteCard = {
      id: cardId,
      skillId,
      tags: [skillId],
      mode: "recall",
      title: t("Untitled note", "未命名笔记"),
      prompt: t("Without looking at the note, explain its core concept in your own words.", "不看笔记，用自己的话解释这条知识的核心概念。"),
      hintKeywords: locale === "zh" ? ["核心概念", "为什么", "例子"] : ["core concept", "why", "example"],
      scaffold: locale === "zh"
        ? ["先给出定义。", "再说明它解决什么问题。", "最后给一个自己的例子。"]
        : ["Start with a definition.", "Explain the problem it solves.", "Finish with an example of your own."],
      noteMarkdown: "",
      goalRelevance: { "amazon-sde2": 0.65, "google-l4": 0.65 },
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
      cardsToImport.forEach((card) => merged.set(card.id, { ...card, tags: card.tags ?? [] }));
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
    setPhase("pre");
    setWorkspaceView("learn");
  };

  const resetMemory = () => {
    clearRecording();
    setGoalProfile(defaultGoalProfile);
    setSkills(initialSkills);
    setCardMemory(createInitialCardMemory(allCards));
    setEvidence([]);
    setSessionQueue([]);
    setPhase("pre");
  };

  const noteSource = currentCard?.noteMarkdown ?? "";

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
          {(phase === "pre" || phase === "post") && (
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

        {phase !== "pre" && phase !== "post" ? (
          <div className="active-header">
            <LanguageSwitch />
            <span>{t("Retrieval in progress", "检索中")}</span>
            <button className="quiet-button" type="button" onClick={finishSession}>{t("End this session", "结束本次学习")}</button>
          </div>
        ) : (
          <div className="header-tools">
            <LanguageSwitch />
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

      {(phase === "pre" || phase === "post") && workspaceView === "notes" && (
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
            <p className="eyebrow">{t("System handles the decision. You handle retrieval.", "系统负责决策，你负责检索。")}</p>
            <h1>{t("Do not plan.", "不用计划。")}<br />{t("When you are ready, do only the card in front of you.", "准备好以后，只做眼前这一张。")}</h1>
            <p>
              {t(
                "NoteFlow does not show to-do lists, debts, or completion rates. Cards you miss return naturally to the scheduling pool and compete for the next retrieval opportunity like every other piece of knowledge.",
                "NoteFlow 不展示待办、欠账或完成率。没做到的卡会自然回到调度池，和所有知识一样重新竞争下一次检索机会。",
              )}
            </p>
            <GoalPlanner profile={goalProfile} onChange={setGoalProfile} />
            <button className="primary-button start-session-button" type="button" onClick={beginSession}>
              {t("Start this session", "开始本次学习")}
              <span aria-hidden="true">→</span>
            </button>
          </div>
          <SkillStateView skills={skills} eyebrow={t("Before session", "Session 前")} title={t("Current skill state", "当前能力状态")} />
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
            <button className="primary-button" type="button" onClick={() => setPhase("pre")}>
              {t("Return to the start", "回到开始前")}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <SkillStateView skills={skills} eyebrow={t("After session", "Session 后")} title={t("Updated skill state", "更新后的能力状态")} />
        </section>
      )}

      {phase !== "pre" && phase !== "post" && currentCard && (
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
                <button className="skip-button" type="button" onClick={skipCurrentCard}>
                  {t("Skip · move to the end of this session", "Skip · 放到本次队尾")}
                </button>
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
