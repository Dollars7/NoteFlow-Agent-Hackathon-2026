"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  extractAgentSection,
  extractAgentText,
  extractExplicitPlanningSignals,
  extractGeneratedPlan,
  extractNextRetrieval,
  extractNextRetrievalPrompts,
  createRetrievalTitle,
  hackathonHandoffKey,
  normalizeGeneratedPlan,
  projectKnowledgeAreas,
  type GeneratedPlanSettings,
  type HackathonHandoff,
  type LearnerContext,
  type StartMode,
  type StudyPattern,
  type EnergyWindow,
} from "../../lib/hackathon-handoff";
import { useLocale, type Locale } from "../locale";
import styles from "./hackathon.module.css";

type Stage = "intake" | "running" | "clarifying" | "complete" | "error";

const fieldExamples: Record<Locale, { goal: string; notes: string; preferences: string; constraints: string }> = {
  en: {
    goal: "Learn conversational Spanish for a trip",
    notes: "I keep mixing up ser and estar. I can read simple phrases, but I freeze when I speak.",
    preferences: "Short sessions work best for me.",
    constraints: "Weekdays are busy.",
  },
  zh: {
    goal: "为旅行学习日常西班牙语",
    notes: "我总是分不清 ser 和 estar。简单句子看得懂，但开口时会卡住。",
    preferences: "短时间学习更适合我。",
    constraints: "工作日比较忙。",
  },
};

const previewPlans = {
  en: {
    diagnosis: "Your notes contain four topics, but the recurring gap is decision-making under distributed-system tradeoffs.",
    rhythm: "Five short 20-minute sessions each week, aligned with the learner's evening energy window. Stop after one high-value retrieval when energy is low.",
    invitation: "Today at 19:00 — one retrieval, with permission to stop after it.",
    nextPrompt:
      "A checkout service must keep accepting writes during a network partition. What consistency guarantee would you relax, and what user-visible failure would you design for?",
    mutation:
      "Created a prerequisite card for availability vs. latency and moved partition-key design behind quorum reasoning.",
  },
  zh: {
    diagnosis: "你的笔记包含四个主题，但反复出现的缺口是在分布式系统权衡中做出决策。",
    rhythm: "每周五次、每次 20 分钟，安排在学习者晚间精力窗口；精力不足时只完成一次高价值检索即可停止。",
    invitation: "今天 19:00——只做一次检索，完成后可以直接停止。",
    nextPrompt:
      "结账服务必须在网络分区期间继续接受写入。你会放宽哪一种一致性保证，又会为哪一种用户可见故障做设计？",
    mutation: "已创建‘可用性与延迟’前置卡，并把分区键设计安排在法定人数推理之后。",
  },
} as const;

const previewGeneratedPlans: Record<Locale, GeneratedPlanSettings> = {
  en: {
    goalTitle: "Pass a senior backend systems interview in 21 days",
    roleBaseline: "Senior backend systems interview",
    themes: ["Database sharding", "CAP trade-offs", "Raft consensus", "Cache consistency"],
    paceBias: 74,
    sessionMinutesMin: 15,
    sessionMinutesMax: 25,
    invitationsPerWeekMin: 4,
    invitationsPerWeekMax: 5,
    studyPattern: "short-frequent",
    energyWindow: "evening",
    preferredTime: "19:00",
    reminderOptIn: false,
    dailyMinutes: null,
    startMode: "undecided",
    startDate: "",
    targetDate: "",
    timeZone: "America/Phoenix",
    rationale: "A near-term interview and busy weekdays favor short, frequent verbal retrieval with stronger goal relevance.",
  },
  zh: {
    goalTitle: "在 21 天内通过高级后端系统面试",
    roleBaseline: "高级后端系统面试",
    themes: ["数据库分片", "CAP 权衡", "Raft 共识", "缓存一致性"],
    paceBias: 74,
    sessionMinutesMin: 15,
    sessionMinutesMax: 25,
    invitationsPerWeekMin: 4,
    invitationsPerWeekMax: 5,
    studyPattern: "short-frequent",
    energyWindow: "evening",
    preferredTime: "19:00",
    reminderOptIn: false,
    dailyMinutes: null,
    startMode: "undecided",
    startDate: "",
    targetDate: "",
    timeZone: "America/Phoenix",
    rationale: "近期面试目标和繁忙工作日更适合少量多次的口述检索，并提高目标相关内容的权重。",
  },
};

function inlineMarkdown(source: string): ReactNode[] {
  return source.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return <span key={index}>{part}</span>;
  });
}

function MarkdownReport({ source, compact = false }: { source: string; compact?: boolean }) {
  const knownHeading = /^(diagnosis|rhythm plan|next invitation|next retrieval|model mutation|knowledge model update|background work|clarification|诊断|学习节奏|下次邀请|下一次检索|模型更新|知识模型更新|后台工作|澄清问题)$/i;

  return (
    <div className={`${styles.markdownReport} ${compact ? styles.markdownCompact : ""}`}>
      {source.split(/\r?\n/).map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return null;
        if (/^---+$/.test(line)) return <hr key={index} />;
        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
          const level = Math.min(3, heading[1].length);
          if (level === 1) return <h2 key={index}>{inlineMarkdown(heading[2])}</h2>;
          if (level === 2) return <h3 key={index}>{inlineMarkdown(heading[2])}</h3>;
          return <h4 key={index}>{inlineMarkdown(heading[2])}</h4>;
        }
        if (knownHeading.test(line.replace(/^[*_`]+|[*_`]+$/g, ""))) return <h3 key={index}>{line.replace(/^[*_`]+|[*_`]+$/g, "")}</h3>;
        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (bullet) return <div className={styles.markdownBullet} key={index}><i aria-hidden="true" /> <p>{inlineMarkdown(bullet[1])}</p></div>;
        const ordered = line.match(/^(\d+)\.\s+(.+)$/);
        if (ordered) return <div className={styles.markdownBullet} key={index}><b>{ordered[1]}</b><p>{inlineMarkdown(ordered[2])}</p></div>;
        if (line.startsWith("> ")) return <blockquote key={index}>{inlineMarkdown(line.slice(2))}</blockquote>;
        return <p key={index}>{inlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

export function HackathonDemo({ connected }: { connected: boolean }) {
  const { locale, t } = useLocale();
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [learningPreferences, setLearningPreferences] = useState("");
  const [constraints, setConstraints] = useState("");
  const [studyPattern, setStudyPattern] = useState<StudyPattern>("short-frequent");
  const [sessionMinutes, setSessionMinutes] = useState(20);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [energyWindow, setEnergyWindow] = useState<EnergyWindow>("evening");
  const [preferredTime, setPreferredTime] = useState("19:00");
  const [reminderOptIn, setReminderOptIn] = useState(false);
  const [dailyMinutes, setDailyMinutes] = useState<number | null>(null);
  const [startMode, setStartMode] = useState<StartMode>("undecided");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [answer, setAnswer] = useState("");
  const [stage, setStage] = useState<Stage>("intake");
  const [agentText, setAgentText] = useState("");
  const [continuationToken, setContinuationToken] = useState("");
  const [rhythmPlan, setRhythmPlan] = useState("");
  const [nextInvitation, setNextInvitation] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlanSettings | null>(null);
  const [retrievalPrompts, setRetrievalPrompts] = useState<string[]>([]);
  const [progressStep, setProgressStep] = useState(0);
  const [resultLocale, setResultLocale] = useState<Locale | null>(null);
  const [localeNotice, setLocaleNotice] = useState("");
  const progressTimers = useRef<number[]>([]);

  const explicitPlanningSignals = useMemo(() => {
    const inferred = extractExplicitPlanningSignals(goal, notes, learningPreferences, constraints, answer);
    return {
      ...inferred,
      dailyMinutes: dailyMinutes ?? inferred.dailyMinutes,
      preferredTime: inferred.preferredTime || (startMode === "scheduled" ? preferredTime : ""),
      startDate: startDate || inferred.startDate,
      targetDate: targetDate || inferred.targetDate,
    };
  }, [answer, constraints, dailyMinutes, goal, learningPreferences, notes, preferredTime, startDate, startMode, targetDate]);

  const learnerContext = useMemo<LearnerContext>(() => ({
    learningPreferences: learningPreferences.trim(),
    constraints: constraints.trim(),
    studyPattern,
    sessionMinutes,
    daysPerWeek,
    energyWindow,
    preferredTime,
    reminderOptIn,
    dailyMinutes: explicitPlanningSignals.dailyMinutes,
    startMode,
    startDate,
    targetDate,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    explicitPlanningSignals,
  }), [constraints, daysPerWeek, energyWindow, explicitPlanningSignals, learningPreferences, preferredTime, reminderOptIn, sessionMinutes, startDate, startMode, studyPattern, targetDate]);
  const evidenceMissing = notes.trim().length === 0;
  const nextRetrieval = useMemo(
    () => agentText ? extractNextRetrieval(agentText, resultLocale ?? locale) : "",
    [agentText, locale, resultLocale],
  );
  const markdownDownloadHref = useMemo(() => {
    if (!agentText) return "";
    const markdownDocument = [
      `# NoteFlow Agent — ${goal.trim()}`,
      "",
      `> ${t("Study rhythm", "学习节奏")}: ${sessionMinutes} min · ${daysPerWeek}× / ${t("week", "周")}`,
      "",
      agentText.trim(),
      "",
    ].join("\n");
    return `data:text/markdown;charset=utf-8,${encodeURIComponent(markdownDocument)}`;
  }, [agentText, daysPerWeek, goal, sessionMinutes, t]);

  useEffect(() => () => {
    progressTimers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (!agentText || !resultLocale || locale === resultLocale) return;
    setAgentText("");
    setContinuationToken("");
    setRhythmPlan("");
    setNextInvitation("");
    setGeneratedPlan(null);
    setRetrievalPrompts([]);
    setResultLocale(null);
    setProgressStep(0);
    setStage("intake");
    setLocaleNotice(locale === "zh"
      ? "语言已切换。请重新生成，新的计划将只使用中文。"
      : "Language changed. Run again and the new plan will use English only.");
  }, [agentText, locale, resultLocale]);

  const runLabel = useMemo(() => {
    if (stage === "running") return t("Building the learning path…", "正在构建学习路径…");
    if (stage === "clarifying") return t("Continue with this answer", "用这个回答继续");
    if (stage === "complete") return t("Run again with updated evidence", "用更新后的证据再次运行");
    return t("Build my learning path", "生成我的学习路径");
  }, [stage, t]);

  function startProgress(action: "plan" | "clarification") {
    progressTimers.current.forEach((timer) => window.clearTimeout(timer));
    progressTimers.current = [];
    const firstStep = action === "clarification" ? 2 : 1;
    setProgressStep(firstStep);
    const schedule = action === "clarification"
      ? [[900, 3]]
      : [[700, 2], [1_600, 3]];
    progressTimers.current = schedule.map(([delay, step]) => window.setTimeout(() => setProgressStep(step), delay));
  }

  function stopProgress(step: number) {
    progressTimers.current.forEach((timer) => window.clearTimeout(timer));
    progressTimers.current = [];
    setProgressStep(step);
  }

  function applyGeneratedPlan(plan: GeneratedPlanSettings) {
    setGeneratedPlan(plan);
    setStudyPattern(plan.studyPattern);
    setSessionMinutes(Math.round((plan.sessionMinutesMin + plan.sessionMinutesMax) / 2));
    setDaysPerWeek(plan.invitationsPerWeekMax);
    setEnergyWindow(plan.energyWindow);
    setPreferredTime(plan.preferredTime);
    setReminderOptIn(plan.reminderOptIn);
    setDailyMinutes(plan.dailyMinutes);
    setStartMode(plan.startMode);
    setStartDate(plan.startDate);
    setTargetDate(plan.targetDate);
  }

  async function runAgent(action: "plan" | "clarification" = "plan") {
    if (action === "plan" && (!goal.trim() || evidenceMissing)) {
      setLocaleNotice(t(
        "Add a goal and at least one note or stuck point before generating.",
        "生成前，请填写学习目标，并至少写下一条笔记或卡点。",
      ));
      return;
    }
    const requestLocale = locale;
    startProgress(action);
    setStage("running");
    setAgentText("");
    setLocaleNotice("");
    if (action === "plan") {
      setContinuationToken("");
      setRhythmPlan("");
      setNextInvitation("");
      setGeneratedPlan(null);
      setRetrievalPrompts([]);
      setResultLocale(null);
    }

    if (!connected) {
      window.setTimeout(() => {
        const preview = previewPlans[requestLocale];
        const previewReport = requestLocale === "zh"
          ? `诊断\n${preview.diagnosis}\n\n学习节奏\n${preview.rhythm}\n\n下次邀请\n${preview.invitation}\n\n下一次检索\n${preview.nextPrompt}\n\n知识模型更新\n${preview.mutation}`
          : `DIAGNOSIS\n${preview.diagnosis}\n\nRHYTHM PLAN\n${preview.rhythm}\n\nNEXT INVITATION\n${preview.invitation}\n\nNEXT RETRIEVAL\n${preview.nextPrompt}\n\nKNOWLEDGE MODEL UPDATE\n${preview.mutation}`;
        const previewPlan = normalizeGeneratedPlan(previewGeneratedPlans[requestLocale], {
          goal,
          locale: requestLocale,
          learnerContext,
        });
        setAgentText(previewReport);
        setRhythmPlan(preview.rhythm);
        setNextInvitation(preview.invitation);
        setRetrievalPrompts(extractNextRetrievalPrompts(null, previewReport, previewPlan.themes, requestLocale));
        applyGeneratedPlan(previewPlan);
        setResultLocale(requestLocale);
        stopProgress(4);
        setStage("complete");
      }, 720);
      return;
    }

    try {
      const runResponse = await fetch("/api/hackathon-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-noteflow-locale": requestLocale },
        body: JSON.stringify({
          action,
          goal,
          notes,
          clarification: answer,
          locale: requestLocale,
          learnerContext,
          continuationToken: action === "clarification" ? continuationToken : undefined,
        }),
      });

      const payload = (await runResponse.json()) as { events?: unknown; error?: string; continuationToken?: string };
      if (!runResponse.ok) {
        throw new Error(payload.error || t(`Agent run failed (${runResponse.status}).`, `Agent 运行失败（${runResponse.status}）。`));
      }
      const report = extractAgentText(payload.events, requestLocale === "zh"
        ? "Agent 已完成运行，但没有返回文字内容。"
        : "The agent completed the run without a text response.");
      setAgentText(report);
      setResultLocale(requestLocale);
      setContinuationToken(payload.continuationToken ?? continuationToken);
      const clarificationQuestion = extractAgentSection(report, ["clarification", "澄清问题"]);
      if (clarificationQuestion) {
        stopProgress(2);
        setStage("clarifying");
        return;
      }
      const plan = extractGeneratedPlan(payload.events, { goal, locale: requestLocale, learnerContext });
      applyGeneratedPlan(plan);
      setRetrievalPrompts(extractNextRetrievalPrompts(payload.events, report, plan.themes, requestLocale));
      setRhythmPlan(extractAgentSection(report, ["rhythm plan", "学习节奏"]));
      setNextInvitation(extractAgentSection(report, ["next invitation", "下次邀请"]));
      stopProgress(4);
      setStage("complete");
    } catch (error) {
      stopProgress(0);
      setAgentText(error instanceof Error ? error.message : t(
        "The cloud agent could not be reached.",
        "暂时无法连接云端 Agent。",
      ));
      setStage("error");
    }
  }

  function reviewPlanBeforeSession() {
    if (!agentText || stage !== "complete") return;
    const handoffLocale = resultLocale ?? locale;
    const finalPlan = generatedPlan ?? normalizeGeneratedPlan(null, { goal: goal.trim(), locale: handoffLocale, learnerContext });
    const projectId = `learning-project-${Date.now()}`;
    const prompts = retrievalPrompts.length > 0
      ? retrievalPrompts
      : extractNextRetrievalPrompts(null, agentText, finalPlan.themes, handoffLocale);
    const retrievalPrompt = prompts[0];
    const knowledgeAreas = projectKnowledgeAreas(finalPlan.themes);
    const handoff: HackathonHandoff = {
      id: projectId,
      locale: handoffLocale,
      goal: goal.trim(),
      sourceNotes: notes.trim(),
      title: createRetrievalTitle(retrievalPrompt, finalPlan.themes, handoffLocale),
      nextRetrievalPrompts: prompts,
      agentReport: agentText,
      continuationToken,
      learnerContext,
      rhythmPlan,
      nextInvitation,
      generatedPlan: finalPlan,
      project: {
        id: projectId,
        goal: goal.trim(),
        sourceNotes: notes.trim(),
        learningPreferences: learningPreferences.trim(),
        constraints: constraints.trim(),
        themes: finalPlan.themes,
        knowledgeAreas,
        schedule: {
          startMode: finalPlan.startMode,
          startDate: finalPlan.startDate,
          startTime: finalPlan.preferredTime,
          targetDate: finalPlan.targetDate,
          timeZone: finalPlan.timeZone,
          dailyMinutes: finalPlan.dailyMinutes,
          sessionMinutesMin: finalPlan.sessionMinutesMin,
          sessionMinutesMax: finalPlan.sessionMinutesMax,
          invitationsPerWeekMin: finalPlan.invitationsPerWeekMin,
          invitationsPerWeekMax: finalPlan.invitationsPerWeekMax,
        },
      },
      createdAt: new Date().toISOString(),
    };
    window.localStorage.setItem(hackathonHandoffKey, JSON.stringify(handoff));
    window.location.assign("/demo?source=agent");
  }

  const traceSteps = [
    { number: "01", title: t("Ingest", "摄取"), description: t("Goal and messy evidence captured", "已捕获目标和杂乱证据") },
    { number: "02", title: t("Clarify", "澄清"), description: t("Check decision-changing context", "检查会改变决策的上下文") },
    { number: "03", title: t("Synthesize", "综合"), description: t("Build concepts, gaps, and prerequisites", "构建概念、缺口和前置关系") },
    { number: "04", title: t("Mutate", "更新"), description: t("Save the rhythm and next retrieval", "保存学习节奏和下一次检索") },
  ];
  const visibleProgressStep = stage === "complete" ? 4 : progressStep;
  const progressPercent = visibleProgressStep * 25;
  const progressLabel = visibleProgressStep > 0
    ? traceSteps[visibleProgressStep - 1].title
    : t("Ready to begin", "准备开始");

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.intro}>
          <div className={styles.kicker}>
            {t("Messy knowledge in · one deliberate move out", "输入杂乱知识 · 输出一个明确行动")}
          </div>
          <h1>{t("Your notes should notice where you get stuck.", "你的笔记应该知道你卡在哪里。")}</h1>
          <p className={styles.lede}>
            {t(
              "NoteFlow is an autonomous learning partner. It asks for missing context, turns unstructured notes into a knowledge model, and rewrites the path after every retrieval attempt.",
              "NoteFlow 是自主学习伙伴。它会询问缺失的上下文，把非结构化笔记转化为知识模型，并在每次检索练习后重写学习路径。",
            )}
          </p>

          <div className={styles.statusRow}>
            <span className={connected ? styles.liveDot : styles.previewDot} aria-hidden="true" />
            <strong>{connected ? t("Cloud agent connected", "云端 Agent 已连接") : t("Transparent local preview", "透明本地预览")}</strong>
            <span>
              {connected
                ? t(
                    "Gemini generates the plan through Google ADK. Model versions are saved to Firestore; this unfinished form stays in your browser.",
                    "Gemini 通过 Google ADK 生成计划；模型版本保存到 Firestore，尚未生成的表单内容只留在当前浏览器。",
                  )
                : t(
                    "The interface uses labeled sample output until a Cloud Run URL is configured.",
                    "在配置 Cloud Run 地址之前，界面会明确标注并使用示例输出。",
                  )}
            </span>
          </div>
        </div>

        <div className={styles.runPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>{t("Start in your own words", "先用你自己的话描述")}</span>
              <h2>{t("Tell NoteFlow what you need", "告诉 NoteFlow 你需要什么")}</h2>
            </div>
            <span className={styles.runId}>RUN · 001</span>
          </div>

          <label className={styles.field}>
            <span>{t("Learning goal", "学习目标")}</span>
            <input
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder={fieldExamples[locale].goal}
              required
            />
          </label>

          <label className={styles.field}>
            <span>{t("What are you learning or getting stuck on?", "你正在学什么，或者卡在哪里？")}</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={fieldExamples[locale].notes}
              rows={4}
              required
              aria-invalid={evidenceMissing}
              aria-describedby="learning-evidence-help"
            />
            <small id="learning-evidence-help" className={`${styles.fieldHelp} ${evidenceMissing ? styles.fieldError : ""}`}>
              {evidenceMissing
                ? t("Required · add one note, question, or stuck point.", "必填 · 请至少写一条笔记、问题或卡点。")
                : t("This gives the Agent real material to build from.", "Agent 会根据这些真实材料生成计划。")}
            </small>
          </label>

          <details className={styles.moreSettings}>
            <summary>
              <span>{t("More settings", "更多设置")}</span>
              <small>{t("Optional · learning preferences and constraints", "可选 · 学习偏好与现实限制")}</small>
            </summary>
            <div className={styles.contextBlock}>
              <label className={styles.field}>
                <span>{t("What helps you learn", "什么方式最适合你")}</span>
                <textarea
                  value={learningPreferences}
                  onChange={(event) => setLearningPreferences(event.target.value)}
                  placeholder={fieldExamples[locale].preferences}
                  rows={2}
                />
              </label>

              <label className={styles.field}>
                <span>{t("Anything the plan should respect", "计划需要尊重什么限制")}</span>
                <textarea
                  value={constraints}
                  onChange={(event) => setConstraints(event.target.value)}
                  placeholder={fieldExamples[locale].constraints}
                  rows={2}
                />
              </label>
              <div className={styles.planningFields}>
                <label className={styles.field}>
                  <span>{t("Time available each day · optional", "每天大约可投入多久 · 可选")}</span>
                  <div className={styles.numberField}>
                    <input
                      type="number"
                      min="5"
                      max="720"
                      step="5"
                      value={dailyMinutes ?? ""}
                      onChange={(event) => setDailyMinutes(event.target.value ? Number(event.target.value) : null)}
                      placeholder="60"
                    />
                    <i>{t("minutes", "分钟")}</i>
                  </div>
                </label>
                <label className={styles.field}>
                  <span>{t("Goal or delivery date · optional", "考试或交付日期 · 可选")}</span>
                  <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
                </label>
              </div>

              <fieldset className={styles.startChoice}>
                <legend>{t("When should the plan begin?", "计划什么时候开始？")}</legend>
                <div>
                  {([
                    ["undecided", t("Decide later", "稍后再定")],
                    ["now", t("Start now", "现在开始")],
                    ["scheduled", t("Schedule it", "指定时间")],
                  ] as const).map(([value, label]) => (
                    <button
                      type="button"
                      className={startMode === value ? styles.selectedChoice : ""}
                      onClick={() => setStartMode(value)}
                      key={value}
                    >{label}</button>
                  ))}
                </div>
                {startMode === "scheduled" && (
                  <div className={styles.planningFields}>
                    <label className={styles.field}>
                      <span>{t("Start date", "开始日期")}</span>
                      <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                    </label>
                    <label className={styles.field}>
                      <span>{t("Start time", "开始时间")}</span>
                      <input type="time" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} />
                    </label>
                  </div>
                )}
                <small>{t(
                  "Calendar and reminder controls appear only after a start time is confirmed on the review page.",
                  "只有在确认页确定开始时间后，才会出现日历和提醒操作。",
                )}</small>
              </fieldset>
              <p className={styles.inferenceNote}>{t(
                "Anything written in these fields is merged into one instruction. Explicit numbers override defaults, while daily budget and per-session length remain separate.",
                "这里填写的内容都会汇总进同一条指令；明确数字优先于默认值，并且“每日总时长”和“单次时长”会分开处理。",
              )}</p>
            </div>
          </details>

          {localeNotice && <p className={styles.localeNotice}>{localeNotice}</p>}

          {stage === "clarifying" && (
            <label className={`${styles.field} ${styles.clarification}`}>
              <span>{t("One question that changes the plan", "一个会改变计划的问题")}</span>
              <p>{extractAgentSection(agentText, ["clarification", "澄清问题"])}</p>
              <input
                autoFocus
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={t("Answer in your own words", "用你自己的话回答")}
              />
            </label>
          )}

          <button
            className={styles.runButton}
            type="button"
            onClick={() => void runAgent(stage === "clarifying" ? "clarification" : "plan")}
            disabled={stage === "running" || !goal.trim() || evidenceMissing || (stage === "clarifying" && !answer.trim())}
          >
            <span>{runLabel}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <section className={styles.workspace} aria-live="polite">
        <div className={styles.workflowCard}>
          <div className={styles.sectionLabel}>{t("Agent trace", "Agent 运行轨迹")}</div>
          <div className={`${styles.progressSummary} ${stage === "running" ? styles.progressRunning : ""}`}>
            <div>
              <strong>{stage === "running"
                ? t("Generating your learning rhythm…", "正在生成你的学习节奏…")
                : stage === "complete"
                  ? t("Learning rhythm ready", "学习节奏已生成")
                  : stage === "clarifying"
                    ? t("One answer is needed", "还需要一个回答")
                    : t("Ready to generate", "可以开始生成")}</strong>
              <span>{stage === "running"
                ? t(`Step ${visibleProgressStep} of 4 · ${progressLabel}`, `第 ${visibleProgressStep}/4 步 · ${progressLabel}`)
                : stage === "complete"
                  ? t("4 of 4 steps complete", "4/4 步已完成")
                  : t("Progress will appear here", "生成进度会显示在这里")}</span>
            </div>
            <b>{progressPercent}%</b>
          </div>
          <div className={styles.progressTrack} aria-label={t("Agent generation progress", "Agent 生成进度")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} role="progressbar">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <ol className={styles.steps}>
            {traceSteps.map((step, index) => {
              const stepNumber = index + 1;
              const status = stage === "complete" || stepNumber < visibleProgressStep
                ? "done"
                : stepNumber === visibleProgressStep
                  ? "current"
                  : "waiting";
              return (
                <li className={styles[status]} key={step.number} aria-current={status === "current" ? "step" : undefined}>
                  <span>{step.number}</span>
                  <div><strong>{step.title}</strong><p>{step.description}</p></div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={styles.outputCard}>
          <div className={styles.outputHeading}>
            <div className={styles.sectionLabel}>{t("Your learning plan", "你的学习计划")}</div>
            <div className={styles.outputTools}>
              <span className={stage === "running" ? styles.outputStatusRunning : ""}>{stage === "complete"
                ? t("READY", "已就绪")
                : stage === "error"
                  ? t("NEEDS ATTENTION", "需要处理")
                  : stage === "running"
                    ? t("GENERATING", "生成中")
                    : stage === "clarifying"
                      ? t("INPUT NEEDED", "等待回答")
                      : t("READY TO RUN", "等待开始")}</span>
            </div>
          </div>
          {stage === "running" ? (
            <div className={styles.generatingOutput}>
              <span className={styles.generatingIcon} aria-hidden="true" />
              <div>
                <strong>{t("The Agent is building your plan", "Agent 正在生成你的计划")}</strong>
                <p>{t(
                  `Now working on step ${visibleProgressStep}: ${progressLabel}. The finished report will appear here automatically.`,
                  `正在处理第 ${visibleProgressStep} 步：${progressLabel}。完成的报告会自动显示在这里。`,
                )}</p>
                <div className={styles.generatingBars} aria-hidden="true"><i /><i /><i /></div>
              </div>
            </div>
          ) : stage === "complete" && agentText && generatedPlan ? (
            <div className={styles.planSummary}>
              <div className={styles.planSummaryHeading}>
                <span>{t("Plan ready", "计划已生成")}</span>
                <h3>{generatedPlan.goalTitle}</h3>
                <p>{generatedPlan.rationale}</p>
              </div>
              <div className={styles.planSummaryGrid}>
                <div>
                  <span>{t("Focus", "学习重点")}</span>
                  <strong>{generatedPlan.themes.slice(0, 3).join(" · ")}</strong>
                </div>
                <div>
                  <span>{t("Session length", "每次学习时长")}</span>
                  <strong>{generatedPlan.sessionMinutesMin}–{generatedPlan.sessionMinutesMax} min</strong>
                </div>
                <div>
                  <span>{t("Study reminders", "学习提醒")}</span>
                  <strong>{generatedPlan.invitationsPerWeekMin}–{generatedPlan.invitationsPerWeekMax}× / {t("week", "周")}</strong>
                </div>
                <div>
                  <span>{t("Daily time budget", "每日时间预算")}</span>
                  <strong>{generatedPlan.dailyMinutes
                    ? <>{generatedPlan.dailyMinutes} min</>
                    : t("Not specified", "未指定")}</strong>
                </div>
                <div>
                  <span>{t("Start", "开始时间")}</span>
                  <strong>{generatedPlan.startMode === "now"
                    ? t("Start now", "现在开始")
                    : generatedPlan.startMode === "scheduled" && generatedPlan.startDate
                      ? generatedPlan.startDate + " · " + generatedPlan.preferredTime
                      : t("Decide on review page", "在确认页再决定")}</strong>
                </div>
              </div>
            </div>
          ) : agentText ? (
            <div className={stage === "error" ? styles.errorOutput : undefined}><MarkdownReport source={agentText} /></div>
          ) : (
            <div className={styles.emptyOutput}>
              <span aria-hidden="true">↳</span>
              <p>{t(
                "Add a goal and one real note. The Agent will turn them into a short, adjustable plan.",
                "填写目标和一条真实笔记，Agent 会把它们变成简短、可调整的计划。",
              )}</p>
            </div>
          )}
          {stage === "complete" && agentText && (
            <details className={styles.auditDetails}>
              <summary>{t("Agent details and audit trail", "Agent 详情与审计记录")}</summary>
              <MarkdownReport source={agentText} />
              <a href={markdownDownloadHref} download="noteflow-learning-plan.md">{t("Download full report (.md)", "下载完整报告（.md）")}</a>
            </details>
          )}
          {stage === "complete" && agentText && (
            <div className={styles.handoffAction}>
              <div className={styles.handoffPrompt}>
                <span className={styles.handoffPromptLabel}>{t("Plan generated · confirmation comes next", "计划已生成 · 下一步先确认")}</span>
                <strong>{t("Review the Agent's settings before learning", "开始学习前，先确认 Agent 生成的设置")}</strong>
                <p>{nextRetrieval}</p>
                <small>{t(
                  "Your goal, inferred themes, pace range, session range, and first retrieval move to the review page. Learning starts only after you press Start this session.",
                  "你的目标、推断主题、强度范围、时长范围和第一次检索会进入确认页；只有再次点击“开始本次学习”才真正开始。",
                )}</small>
              </div>
              <div className={styles.handoffButtonGroup}>
                <button type="button" onClick={reviewPlanBeforeSession}>
                  {t("Review plan", "确认学习计划")} <span aria-hidden="true">→</span>
                </button>
                <small>{t("Does not start the session yet", "此时还不会开始 Session")}</small>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={styles.proof}>
        <div>
          <div className={styles.sectionLabel}>{t("What makes it agentic", "为什么它是 Agentic")}</div>
          <h2>{t("It changes the learning system, not just the wording.", "它改变的是学习系统，而不只是措辞。")}</h2>
        </div>
        <div className={styles.proofGrid}>
          <article><span>01</span><h3>{t("Leads with judgment", "用判断力带路")}</h3><p>{t("Asks a clarification only when the answer changes the learning path.", "只有当答案会改变学习路径时才提出澄清问题。")}</p></article>
          <article><span>02</span><h3>{t("Mutates knowledge", "更新知识结构")}</h3><p>{t("Creates prerequisites, repairs prompts, and reorders the concept graph.", "创建前置知识、修复检索问题并重排概念图。")}</p></article>
          <article><span>03</span><h3>{t("Works after the tab closes", "关闭页面后继续工作")}</h3><p>{t("Queues deep analysis while the learner keeps practicing.", "在学习者继续练习时，将深度分析放入后台队列。")}</p></article>
        </div>
        <div className={styles.stack} aria-label={t("Hackathon technology stack", "Hackathon 技术栈")}>
          <span>Gemini 3.5 Flash</span><span>Google ADK</span><span>Cloud Run</span><span>Firestore</span><span>Pub/Sub</span>
        </div>
      </section>
    </>
  );
}
