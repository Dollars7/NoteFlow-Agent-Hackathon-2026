"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  extractAgentSection,
  extractAgentText,
  extractNextRetrieval,
  hackathonHandoffKey,
  type HackathonHandoff,
  type LearnerContext,
  type StudyPattern,
  type EnergyWindow,
} from "../../lib/hackathon-handoff";
import { useLocale, type Locale } from "../locale";
import styles from "./hackathon.module.css";

type Stage = "intake" | "running" | "clarifying" | "complete" | "error";

const samples: Record<Locale, { goal: string; notes: string }> = {
  en: {
    goal: "Pass a senior backend systems interview in 21 days",
    notes: `CAP theorem — I keep mixing up availability with latency.
Consensus: leader election, terms, quorum? Review Raft diagram.
Redis cache invalidation — stale reads happened in the project.
I can explain sharding, but freeze when asked to choose a partition key.`,
  },
  zh: {
    goal: "在 21 天内通过高级后端系统面试",
    notes: `CAP 定理——我总是把可用性和延迟混在一起。
共识：领导者选举、任期、法定人数？需要复习 Raft 图。
Redis 缓存失效——项目中曾出现陈旧读取。
我能解释分片，但一被问到如何选择分区键就卡住。`,
  },
};

const contextSamples: Record<Locale, { preferences: string; constraints: string }> = {
  en: {
    preferences: "I focus best in short sessions and remember more when I explain ideas aloud.",
    constraints: "Weekdays are busy; avoid long evening sessions and never create overdue work.",
  },
  zh: {
    preferences: "我更适合短时间学习，而且把概念说出来时记得更牢。",
    constraints: "工作日比较忙；避免过长的晚间学习，也不要制造逾期任务。",
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

function nextReminderDate(preferredTime: string): Date {
  const [hours, minutes] = preferredTime.split(":").map(Number);
  const next = new Date();
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= Date.now() + 60_000) next.setDate(next.getDate() + 1);
  return next;
}

function formatIcsDate(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

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
  const [goal, setGoal] = useState(samples.en.goal);
  const [notes, setNotes] = useState(samples.en.notes);
  const [learningPreferences, setLearningPreferences] = useState(contextSamples.en.preferences);
  const [constraints, setConstraints] = useState(contextSamples.en.constraints);
  const [studyPattern, setStudyPattern] = useState<StudyPattern>("short-frequent");
  const [sessionMinutes, setSessionMinutes] = useState(20);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [energyWindow, setEnergyWindow] = useState<EnergyWindow>("evening");
  const [preferredTime, setPreferredTime] = useState("19:00");
  const [reminderOptIn, setReminderOptIn] = useState(true);
  const [answer, setAnswer] = useState("");
  const [stage, setStage] = useState<Stage>("intake");
  const [agentText, setAgentText] = useState("");
  const [continuationToken, setContinuationToken] = useState("");
  const [rhythmPlan, setRhythmPlan] = useState("");
  const [nextInvitation, setNextInvitation] = useState("");
  const [reminderStatus, setReminderStatus] = useState("");
  const [progressStep, setProgressStep] = useState(0);
  const previousLocale = useRef<Locale>("en");
  const reminderTimer = useRef<number | null>(null);
  const progressTimers = useRef<number[]>([]);

  const learnerContext = useMemo<LearnerContext>(() => ({
    learningPreferences: learningPreferences.trim(),
    constraints: constraints.trim(),
    studyPattern,
    sessionMinutes,
    daysPerWeek,
    energyWindow,
    preferredTime,
    reminderOptIn,
  }), [constraints, daysPerWeek, energyWindow, learningPreferences, preferredTime, reminderOptIn, sessionMinutes, studyPattern]);
  const nextRetrieval = useMemo(
    () => agentText ? extractNextRetrieval(agentText, locale) : "",
    [agentText, locale],
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
    const previous = samples[previousLocale.current];
    const next = samples[locale];
    setGoal((current) => current === previous.goal ? next.goal : current);
    setNotes((current) => current === previous.notes ? next.notes : current);
    setLearningPreferences((current) => current === contextSamples[previousLocale.current].preferences
      ? contextSamples[locale].preferences
      : current);
    setConstraints((current) => current === contextSamples[previousLocale.current].constraints
      ? contextSamples[locale].constraints
      : current);
    setAnswer((current) => {
      if (current === "Make the design decision under pressure") {
        return locale === "zh" ? "在压力下做出正确的设计决策" : current;
      }
      if (current === "在压力下做出正确的设计决策") {
        return locale === "en" ? "Make the design decision under pressure" : current;
      }
      return current;
    });
    previousLocale.current = locale;
  }, [locale]);

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

  async function runAgent(action: "plan" | "clarification" = "plan") {
    startProgress(action);
    setStage("running");
    setAgentText("");
    setReminderStatus("");
    if (action === "plan") {
      setContinuationToken("");
      setRhythmPlan("");
      setNextInvitation("");
    }

    if (!connected) {
      window.setTimeout(() => {
        const preview = previewPlans[locale];
        setAgentText(
          locale === "zh"
            ? `诊断\n${preview.diagnosis}\n\n学习节奏\n${preview.rhythm}\n\n下次邀请\n${preview.invitation}\n\n下一次检索\n${preview.nextPrompt}\n\n知识模型更新\n${preview.mutation}`
            : `DIAGNOSIS\n${preview.diagnosis}\n\nRHYTHM PLAN\n${preview.rhythm}\n\nNEXT INVITATION\n${preview.invitation}\n\nNEXT RETRIEVAL\n${preview.nextPrompt}\n\nKNOWLEDGE MODEL UPDATE\n${preview.mutation}`,
        );
        setRhythmPlan(preview.rhythm);
        setNextInvitation(preview.invitation);
        stopProgress(4);
        setStage("complete");
      }, 720);
      return;
    }

    try {
      const runResponse = await fetch("/api/hackathon-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-noteflow-locale": locale },
        body: JSON.stringify({
          action,
          goal,
          notes,
          clarification: answer,
          locale,
          learnerContext,
          continuationToken: action === "clarification" ? continuationToken : undefined,
        }),
      });

      const payload = (await runResponse.json()) as { events?: unknown; error?: string; continuationToken?: string };
      if (!runResponse.ok) {
        throw new Error(payload.error || t(`Agent run failed (${runResponse.status}).`, `Agent 运行失败（${runResponse.status}）。`));
      }
      const report = extractAgentText(payload.events, t(
        "The agent completed the run without a text response.",
        "Agent 已完成运行，但没有返回文字内容。",
      ));
      setAgentText(report);
      setContinuationToken(payload.continuationToken ?? continuationToken);
      const clarificationQuestion = extractAgentSection(report, ["clarification", "澄清问题"]);
      if (clarificationQuestion) {
        stopProgress(2);
        setStage("clarifying");
        return;
      }
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

  function practiceNextStep() {
    if (!agentText || stage !== "complete") return;
    const handoff: HackathonHandoff = {
      id: `agent-retrieval-${Date.now()}`,
      locale,
      goal: goal.trim(),
      sourceNotes: notes.trim(),
      title: t("Agent-selected next retrieval", "Agent 选择的下一次检索"),
      nextRetrievalPrompt: extractNextRetrieval(agentText, locale),
      agentReport: agentText,
      continuationToken,
      learnerContext,
      rhythmPlan,
      nextInvitation,
      createdAt: new Date().toISOString(),
    };
    window.localStorage.setItem(hackathonHandoffKey, JSON.stringify(handoff));
    window.location.assign("/demo?source=agent");
  }

  function downloadCalendarInvitation() {
    const startsAt = nextReminderDate(preferredTime);
    const endsAt = new Date(startsAt.getTime() + sessionMinutes * 60_000);
    const title = t("NoteFlow learning invitation", "NoteFlow 学习邀请");
    const description = t(
      "Open NoteFlow and complete the single retrieval selected for this rhythm. Stopping after it is allowed.",
      "打开 NoteFlow，完成当前节奏选择的一次检索；做完即可停止。",
    );
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NoteFlow//Learning Rhythm//EN", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT", `UID:noteflow-${Date.now()}@noteflow`, `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startsAt)}`, `DTEND:${formatIcsDate(endsAt)}`,
      `SUMMARY:${title}`, `DESCRIPTION:${description}`, "BEGIN:VALARM", "TRIGGER:-PT10M",
      "ACTION:DISPLAY", `DESCRIPTION:${title}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "noteflow-learning-invitation.ics";
    link.click();
    URL.revokeObjectURL(url);
    setReminderStatus(t("Calendar invitation downloaded.", "日历邀请已下载。"));
  }

  async function enableBrowserReminder() {
    if (!("Notification" in window)) {
      setReminderStatus(t("This browser does not support notifications. Use the calendar invitation instead.", "当前浏览器不支持通知，请改用日历邀请。"));
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setReminderStatus(t("Notification permission was not enabled.", "未开启通知权限。"));
      return;
    }
    const startsAt = nextReminderDate(preferredTime);
    window.localStorage.setItem("noteflow-next-reminder-v1", JSON.stringify({ at: startsAt.toISOString(), rhythmPlan }));
    if (reminderTimer.current) window.clearTimeout(reminderTimer.current);
    const delay = startsAt.getTime() - Date.now();
    if (delay <= 2_147_483_647) {
      reminderTimer.current = window.setTimeout(() => {
        new Notification(t("Your NoteFlow invitation is ready", "你的 NoteFlow 学习邀请到了"), {
          body: t("Open one retrieval. There is no overdue work.", "只做一次检索，没有逾期任务。"),
        });
      }, delay);
    }
    new Notification(t("NoteFlow reminder enabled", "NoteFlow 提醒已开启"), {
      body: t(`Next invitation: ${startsAt.toLocaleString()}`, `下次邀请：${startsAt.toLocaleString()}`),
    });
    setReminderStatus(t("Browser reminder enabled. Keep the calendar invitation as the durable reminder.", "浏览器提醒已开启；日历邀请可作为关闭页面后的持久提醒。"));
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
                    "Responses come from Gemini 3.5 through the deployed Google ADK agent.",
                    "回复由已部署的 Google ADK Agent 调用 Gemini 3.5 生成。",
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
              <span>{t("Live workflow", "实时工作流")}</span>
              <h2>{t("Build my next move", "生成我的下一步")}</h2>
            </div>
            <span className={styles.runId}>RUN · 001</span>
          </div>

          <label className={styles.field}>
            <span>{t("Learning goal", "学习目标")}</span>
            <input value={goal} onChange={(event) => setGoal(event.target.value)} />
          </label>

          <label className={styles.field}>
            <span>{t("Unstructured evidence", "非结构化学习证据")}</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={6} />
          </label>

          <div className={styles.contextBlock}>
            <div className={styles.contextHeading}>
              <span>{t("Your learning rhythm", "你的学习节奏")}</span>
              <small>{t("Self-described context, never a personality diagnosis", "由你自己描述，不做性格诊断")}</small>
            </div>

            <label className={styles.field}>
              <span>{t("What helps you learn", "什么方式最适合你")}</span>
              <textarea value={learningPreferences} onChange={(event) => setLearningPreferences(event.target.value)} rows={2} />
            </label>

            <label className={styles.field}>
              <span>{t("Constraints the plan must respect", "计划必须尊重的限制")}</span>
              <textarea value={constraints} onChange={(event) => setConstraints(event.target.value)} rows={2} />
            </label>

            <div className={styles.contextGrid}>
              <label className={styles.field}>
                <span>{t("Pattern", "学习方式")}</span>
                <select value={studyPattern} onChange={(event) => setStudyPattern(event.target.value as StudyPattern)}>
                  <option value="short-frequent">{t("Short + frequent", "少量多次")}</option>
                  <option value="fixed-daily">{t("Fixed daily time", "每天固定时间")}</option>
                  <option value="energy-aligned">{t("Follow energy", "跟随精力窗口")}</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>{t("Session", "每次时长")}</span>
                <select value={sessionMinutes} onChange={(event) => setSessionMinutes(Number(event.target.value))}>
                  {[10, 20, 30, 45].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>{t("Days / week", "每周天数")}</span>
                <select value={daysPerWeek} onChange={(event) => setDaysPerWeek(Number(event.target.value))}>
                  {[3, 4, 5, 6, 7].map((days) => <option key={days} value={days}>{days}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>{t("Best energy", "最佳精力")}</span>
                <select value={energyWindow} onChange={(event) => setEnergyWindow(event.target.value as EnergyWindow)}>
                  <option value="morning">{t("Morning", "早晨")}</option>
                  <option value="midday">{t("Midday", "中午")}</option>
                  <option value="evening">{t("Evening", "晚间")}</option>
                  <option value="variable">{t("It varies", "每天不同")}</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>{t("Invitation time", "邀请时间")}</span>
                <input type="time" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} />
              </label>
            </div>

            <label className={styles.reminderChoice}>
              <input type="checkbox" checked={reminderOptIn} onChange={(event) => setReminderOptIn(event.target.checked)} />
              <span>{t("Offer an opt-in reminder after the plan is ready", "计划生成后提供可选提醒")}</span>
            </label>
          </div>

          {stage === "clarifying" && (
            <label className={`${styles.field} ${styles.clarification}`}>
              <span>{t("One question that changes the plan", "一个会改变计划的问题")}</span>
              <p>{extractAgentSection(agentText, ["clarification", "澄清问题"])}</p>
              <input
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
            disabled={stage === "running" || !goal.trim() || !notes.trim() || (stage === "clarifying" && !answer.trim())}
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
            <div className={styles.sectionLabel}>{t("Partner response", "伙伴回复")}</div>
            <div className={styles.outputTools}>
              {stage === "complete" && agentText && (
                <a href={markdownDownloadHref} download="noteflow-learning-plan.md">{t("Download .md", "下载 .md")}</a>
              )}
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
          ) : agentText ? (
            <MarkdownReport source={agentText} />
          ) : (
            <div className={styles.emptyOutput}>
              <span aria-hidden="true">↳</span>
              <p>{t(
                "The agent will return one diagnosis, one next retrieval prompt, and an auditable change to the learning model.",
                "Agent 将返回一项诊断、一个下一次检索问题，以及一次可审计的学习模型变更。",
              )}</p>
            </div>
          )}
          {stage === "complete" && rhythmPlan && (
            <div className={styles.rhythmCard}>
              <div className={styles.rhythmHeading}>
                <span>{t("P0 rhythm created", "P0 学习节奏已生成")}</span>
                <strong>{sessionMinutes} min · {daysPerWeek}× / {t("week", "周")}</strong>
              </div>
              <MarkdownReport source={rhythmPlan} compact />
              {nextInvitation && (
                <div className={styles.invitationLine}>
                  <span>{t("Next invitation", "下次邀请")}</span>
                  <MarkdownReport source={nextInvitation} compact />
                </div>
              )}
              {reminderOptIn && (
                <div className={styles.reminderActions}>
                  <button type="button" onClick={downloadCalendarInvitation}>{t("Add to calendar", "添加到日历")}</button>
                  <button type="button" onClick={() => void enableBrowserReminder()}>{t("Enable browser reminder", "开启浏览器提醒")}</button>
                </div>
              )}
              {reminderStatus && <small className={styles.reminderStatus}>{reminderStatus}</small>}
            </div>
          )}
          {stage === "complete" && agentText && (
            <div className={styles.handoffAction}>
              <div className={styles.handoffPrompt}>
                <span className={styles.handoffPromptLabel}>{t("Your first retrieval", "你的第一次检索")}</span>
                <strong>{t("Ready for one focused learning session?", "准备开始一次专注学习吗？")}</strong>
                <p>{nextRetrieval}</p>
                <small>{t(
                  "Clicking starts NoteFlow learning mode immediately with this one Agent-selected question. Your goal, evidence, and report move with it.",
                  "点击后会立即进入 NoteFlow 学习模式，并从这个 Agent 选择的问题开始；你的目标、证据和报告会一起带入。",
                )}</small>
              </div>
              <div className={styles.handoffButtonGroup}>
                <button type="button" onClick={practiceNextStep}>
                  {t("Start learning now", "现在开始学习")} <span aria-hidden="true">→</span>
                </button>
                <small>{t("Opens NoteFlow retrieval mode", "进入 NoteFlow 检索模式")}</small>
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
