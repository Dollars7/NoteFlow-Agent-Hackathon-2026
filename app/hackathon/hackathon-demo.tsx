"use client";

import { useMemo, useState } from "react";
import styles from "./hackathon.module.css";

type Stage = "intake" | "clarify" | "running" | "complete" | "error";

const sampleNotes = `CAP theorem — I keep mixing up availability with latency.
Consensus: leader election, terms, quorum? Review Raft diagram.
Redis cache invalidation — stale reads happened in the project.
I can explain sharding, but freeze when asked to choose a partition key.`;

const previewPlan = {
  diagnosis: "Your notes contain four topics, but the recurring gap is decision-making under distributed-system tradeoffs.",
  nextPrompt:
    "A checkout service must keep accepting writes during a network partition. What consistency guarantee would you relax, and what user-visible failure would you design for?",
  mutation:
    "Created a prerequisite card for availability vs. latency and moved partition-key design behind quorum reasoning.",
};

function extractAgentText(events: unknown): string {
  if (!Array.isArray(events)) return "The agent completed the run without a text response.";

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

  return "The agent completed the run without a text response.";
}

export function HackathonDemo() {
  const [goal, setGoal] = useState("Pass a senior backend systems interview in 21 days");
  const [notes, setNotes] = useState(sampleNotes);
  const [answer, setAnswer] = useState("");
  const [stage, setStage] = useState<Stage>("intake");
  const [agentText, setAgentText] = useState("");

  const agentUrl = process.env.NEXT_PUBLIC_NOTEFLOW_AGENT_URL?.replace(/\/$/, "") ?? "";
  const appName = process.env.NEXT_PUBLIC_NOTEFLOW_AGENT_APP_NAME ?? "agent";
  const isConnected = Boolean(agentUrl);
  const runLabel = useMemo(() => {
    if (stage === "running") return "Building the learning path…";
    if (stage === "clarify") return "Continue with this context";
    if (stage === "complete") return "Run again with updated evidence";
    return "Let NoteFlow lead";
  }, [stage]);

  async function runAgent() {
    if (stage === "intake") {
      setStage("clarify");
      return;
    }

    setStage("running");
    setAgentText("");

    if (!isConnected) {
      window.setTimeout(() => {
        setAgentText(
          `${previewPlan.diagnosis}\n\nNEXT RETRIEVAL\n${previewPlan.nextPrompt}\n\nKNOWLEDGE MODEL UPDATE\n${previewPlan.mutation}`,
        );
        setStage("complete");
      }, 720);
      return;
    }

    try {
      const userId = `judge-${crypto.randomUUID()}`;
      const sessionId = crypto.randomUUID();
      const sessionResponse = await fetch(
        `${agentUrl}/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal, sourceType: "messy_notes" }),
        },
      );

      if (!sessionResponse.ok && sessionResponse.status !== 409) {
        throw new Error(`Session creation failed (${sessionResponse.status}).`);
      }

      const prompt = [
        `Learning goal: ${goal}`,
        `Learner clarification: ${answer || "No additional context provided."}`,
        "Messy source notes:",
        notes,
        "Lead the learner. Diagnose the knowledge structure, mutate the learning model with your tools, and give exactly one next retrieval prompt.",
      ].join("\n\n");

      const runResponse = await fetch(`${agentUrl}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName,
          userId,
          sessionId,
          newMessage: { role: "user", parts: [{ text: prompt }] },
        }),
      });

      if (!runResponse.ok) throw new Error(`Agent run failed (${runResponse.status}).`);
      setAgentText(extractAgentText(await runResponse.json()));
      setStage("complete");
    } catch (error) {
      setAgentText(error instanceof Error ? error.message : "The cloud agent could not be reached.");
      setStage("error");
    }
  }

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.intro}>
          <div className={styles.kicker}>Messy knowledge in · one deliberate move out</div>
          <h1>Your notes should notice where you get stuck.</h1>
          <p className={styles.lede}>
            NoteFlow is an autonomous learning partner. It asks for missing context, turns unstructured notes into a knowledge model, and rewrites the path after every retrieval attempt.
          </p>

          <div className={styles.statusRow}>
            <span className={isConnected ? styles.liveDot : styles.previewDot} aria-hidden="true" />
            <strong>{isConnected ? "Cloud agent connected" : "Transparent local preview"}</strong>
            <span>
              {isConnected
                ? "Responses come from the deployed ADK agent."
                : "The interface uses labeled sample output until a Cloud Run URL is configured."}
            </span>
          </div>
        </div>

        <div className={styles.runPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Live workflow</span>
              <h2>Build my next move</h2>
            </div>
            <span className={styles.runId}>RUN · 001</span>
          </div>

          <label className={styles.field}>
            <span>Learning goal</span>
            <input value={goal} onChange={(event) => setGoal(event.target.value)} />
          </label>

          <label className={styles.field}>
            <span>Unstructured evidence</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={6} />
          </label>

          {stage !== "intake" && (
            <label className={`${styles.field} ${styles.clarification}`}>
              <span>One clarification from NoteFlow</span>
              <p>Which moment matters more right now: explaining the concept clearly, or making the right design decision under pressure?</p>
              <input
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="e.g. Make the design decision under pressure"
              />
            </label>
          )}

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
          <div className={styles.sectionLabel}>Agent trace</div>
          <ol className={styles.steps}>
            <li className={styles.done}><span>01</span><div><strong>Ingest</strong><p>Goal and messy evidence captured</p></div></li>
            <li className={stage === "intake" ? styles.waiting : styles.done}><span>02</span><div><strong>Clarify</strong><p>Ask only for decision-changing context</p></div></li>
            <li className={["running", "complete"].includes(stage) ? styles.done : styles.waiting}><span>03</span><div><strong>Synthesize</strong><p>Build concepts, gaps, and prerequisites</p></div></li>
            <li className={stage === "complete" ? styles.done : styles.waiting}><span>04</span><div><strong>Mutate</strong><p>Persist the model and queue deeper work</p></div></li>
          </ol>
        </div>

        <div className={styles.outputCard}>
          <div className={styles.outputHeading}>
            <div className={styles.sectionLabel}>Partner response</div>
            <span>{stage === "complete" ? "READY" : stage === "error" ? "NEEDS ATTENTION" : "WAITING"}</span>
          </div>
          {agentText ? (
            <pre>{agentText}</pre>
          ) : (
            <div className={styles.emptyOutput}>
              <span aria-hidden="true">↳</span>
              <p>The agent will return one diagnosis, one next retrieval prompt, and an auditable change to the learning model.</p>
            </div>
          )}
        </div>
      </section>

      <section className={styles.proof}>
        <div>
          <div className={styles.sectionLabel}>What makes it agentic</div>
          <h2>It changes the learning system, not just the wording.</h2>
        </div>
        <div className={styles.proofGrid}>
          <article><span>01</span><h3>Leads with judgment</h3><p>Asks a clarification only when the answer changes the learning path.</p></article>
          <article><span>02</span><h3>Mutates knowledge</h3><p>Creates prerequisites, repairs prompts, and reorders the concept graph.</p></article>
          <article><span>03</span><h3>Works after the tab closes</h3><p>Queues deep analysis while the learner keeps practicing.</p></article>
        </div>
        <div className={styles.stack} aria-label="Hackathon technology stack">
          <span>Gemini 3.5 Flash</span><span>Google ADK</span><span>Cloud Run</span><span>Firestore</span><span>Pub/Sub</span>
        </div>
      </section>
    </>
  );
}
