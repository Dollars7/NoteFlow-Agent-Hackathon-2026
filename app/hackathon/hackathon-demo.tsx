"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  extractNextRetrieval,
  hackathonHandoffKey,
  type HackathonHandoff,
} from "../../lib/hackathon-handoff";
import { useLocale, type Locale } from "../locale";
import styles from "./hackathon.module.css";

type Stage = "intake" | "running" | "complete" | "error";

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

const previewPlans = {
  en: {
    diagnosis: "Your notes contain four topics, but the recurring gap is decision-making under distributed-system tradeoffs.",
    nextPrompt:
      "A checkout service must keep accepting writes during a network partition. What consistency guarantee would you relax, and what user-visible failure would you design for?",
    mutation:
      "Created a prerequisite card for availability vs. latency and moved partition-key design behind quorum reasoning.",
  },
  zh: {
    diagnosis: "你的笔记包含四个主题，但反复出现的缺口是在分布式系统权衡中做出决策。",
    nextPrompt:
      "结账服务必须在网络分区期间继续接受写入。你会放宽哪一种一致性保证，又会为哪一种用户可见故障做设计？",
    mutation: "已创建‘可用性与延迟’前置卡，并把分区键设计安排在法定人数推理之后。",
  },
} as const;

function extractAgentText(events: unknown, fallback: string): string {
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

export function HackathonDemo({ connected }: { connected: boolean }) {
  const { locale, t } = useLocale();
  const [goal, setGoal] = useState(samples.en.goal);
  const [notes, setNotes] = useState(samples.en.notes);
  const [answer, setAnswer] = useState("");
  const [stage, setStage] = useState<Stage>("intake");
  const [agentText, setAgentText] = useState("");
  const previousLocale = useRef<Locale>("en");

  useEffect(() => {
    const previous = samples[previousLocale.current];
    const next = samples[locale];
    setGoal((current) => current === previous.goal ? next.goal : current);
    setNotes((current) => current === previous.notes ? next.notes : current);
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
    if (stage === "complete") return t("Run again with updated evidence", "用更新后的证据再次运行");
    return t("Build my learning path", "生成我的学习路径");
  }, [stage, t]);

  async function runAgent() {
    setStage("running");
    setAgentText("");

    if (!connected) {
      window.setTimeout(() => {
        const preview = previewPlans[locale];
        setAgentText(
          locale === "zh"
            ? `${preview.diagnosis}\n\n下一次检索\n${preview.nextPrompt}\n\n知识模型更新\n${preview.mutation}`
            : `${preview.diagnosis}\n\nNEXT RETRIEVAL\n${preview.nextPrompt}\n\nKNOWLEDGE MODEL UPDATE\n${preview.mutation}`,
        );
        setStage("complete");
      }, 720);
      return;
    }

    try {
      const runResponse = await fetch("/api/hackathon-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-noteflow-locale": locale },
        body: JSON.stringify({ goal, notes, clarification: answer, locale }),
      });

      const payload = (await runResponse.json()) as { events?: unknown; error?: string };
      if (!runResponse.ok) {
        throw new Error(payload.error || t(`Agent run failed (${runResponse.status}).`, `Agent 运行失败（${runResponse.status}）。`));
      }
      setAgentText(extractAgentText(payload.events, t(
        "The agent completed the run without a text response.",
        "Agent 已完成运行，但没有返回文字内容。",
      )));
      setStage("complete");
    } catch (error) {
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
      createdAt: new Date().toISOString(),
    };
    window.localStorage.setItem(hackathonHandoffKey, JSON.stringify(handoff));
    window.location.assign("/demo?source=agent");
  }

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

          <label className={`${styles.field} ${styles.clarification}`}>
            <span>{t("One useful clarification · optional", "一个有用的澄清问题 · 可选")}</span>
            <p>{t(
              "Which moment matters more right now: explaining the concept clearly, or making the right design decision under pressure?",
              "此刻哪件事更重要：把概念解释清楚，还是在压力下做出正确的设计决策？",
            )}</p>
            <input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder={t("e.g. Make the design decision under pressure", "例如：在压力下做出正确的设计决策")}
            />
          </label>

          <button
            className={styles.runButton}
            type="button"
            onClick={() => void runAgent()}
            disabled={stage === "running" || !goal.trim() || !notes.trim()}
          >
            <span>{runLabel}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <section className={styles.workspace} aria-live="polite">
        <div className={styles.workflowCard}>
          <div className={styles.sectionLabel}>{t("Agent trace", "Agent 运行轨迹")}</div>
          <ol className={styles.steps}>
            <li className={styles.done}><span>01</span><div><strong>{t("Ingest", "摄取")}</strong><p>{t("Goal and messy evidence captured", "已捕获目标和杂乱证据")}</p></div></li>
            <li className={stage === "intake" ? styles.waiting : styles.done}><span>02</span><div><strong>{t("Clarify", "澄清")}</strong><p>{t("Ask only for decision-changing context", "只询问会改变决策的上下文")}</p></div></li>
            <li className={["running", "complete"].includes(stage) ? styles.done : styles.waiting}><span>03</span><div><strong>{t("Synthesize", "综合")}</strong><p>{t("Build concepts, gaps, and prerequisites", "构建概念、缺口和前置关系")}</p></div></li>
            <li className={stage === "complete" ? styles.done : styles.waiting}><span>04</span><div><strong>{t("Mutate", "更新")}</strong><p>{t("Persist the model and queue deeper work", "持久化模型并排队深度任务")}</p></div></li>
          </ol>
        </div>

        <div className={styles.outputCard}>
          <div className={styles.outputHeading}>
            <div className={styles.sectionLabel}>{t("Partner response", "伙伴回复")}</div>
            <span>{stage === "complete" ? t("READY", "已就绪") : stage === "error" ? t("NEEDS ATTENTION", "需要处理") : t("WAITING", "等待中")}</span>
          </div>
          {agentText ? (
            <pre>{agentText}</pre>
          ) : (
            <div className={styles.emptyOutput}>
              <span aria-hidden="true">↳</span>
              <p>{t(
                "The agent will return one diagnosis, one next retrieval prompt, and an auditable change to the learning model.",
                "Agent 将返回一项诊断、一个下一次检索问题，以及一次可审计的学习模型变更。",
              )}</p>
            </div>
          )}
          {stage === "complete" && agentText && (
            <div className={styles.handoffAction}>
              <div>
                <strong>{t("The plan now becomes practice.", "现在把计划变成练习。")}</strong>
                <span>{t(
                  "Open the exact next retrieval selected by the Agent. Your goal, evidence, and Agent report move with it.",
                  "打开 Agent 选择的下一次检索；你的目标、证据和 Agent 报告会一起带入学习空间。",
                )}</span>
              </div>
              <button type="button" onClick={practiceNextStep}>
                {t("Practice the next step", "练习下一步")} <span aria-hidden="true">→</span>
              </button>
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
