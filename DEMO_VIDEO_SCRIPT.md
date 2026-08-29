# Four-minute demo video script

> Target length: 3:45-3:55. The final video must be public on YouTube or Vimeo, in English or with English subtitles, and must show the Google Cloud backend running.

## Before recording

- Use the production URL: https://note-flow-agent-hackathon-2026.vercel.app
- Keep the product interface in English.
- Open the public GitHub architecture diagram in another tab.
- Open Google Cloud Console to the entrant-owned project `project-0069ddaa-e176-4b98-9db`.
- Prepare Cloud Run, Firestore, Pub/Sub, and worker-log views, but hide billing details, account details, environment-variable values, tokens, and secrets.
- Use only judge-safe sample learning notes.
- Start the recording before selecting **Build my learning path**. Keep the Agent execution and its visible result unedited so the video contains clear proof of action.
- Rehearse once. If the live Agent run takes longer than expected, shorten the narration rather than cutting the execution.

## 0:00-0:25 — Problem and value

**Screen:** NoteFlow Agent landing page, showing the project name and goal/evidence form.

**Voiceover:**

> Learning plans often become another backlog. Flashcard systems know what is due, but not when a learner has energy, which constraints make a plan unsustainable, or how one real retrieval attempt should change the next session. NoteFlow Agent plans a rhythm, not a debt ledger. It turns messy learning evidence into one deliberate move and then adapts from what actually happens.

## 0:25-0:42 — Category and honest scope

**Screen:** Scroll briefly to **What makes it agentic**, then return to the form.

**Voiceover:**

> This is a Collaborative Partner entry. The retrieval-first NoteFlow foundation existed before the contest and is disclosed in the repository. The new contest work is the autonomous Gemini and Google ADK layer, its persistent model mutations, asynchronous analysis, plan review, and feedback-driven rhythm adaptation.

## 0:42-1:30 — Live Agent execution

**Screen:** Enter concise judge-safe content.

- Learning goal: `Prepare for a senior backend systems interview in 21 days.`
- Note or stuck point: `I can explain sharding, but I freeze when choosing a partition key. I also mix up availability and latency in CAP.`
- Under **More settings**, optionally enter: `Short sessions help me focus. Weekday evenings are busy.`
- Select **Build my learning path**.
- Keep the 01-04 trace and progress visible while the request runs.

**Voiceover:**

> I provide a goal, two messy stuck points, and an optional real-life constraint. I do not choose a fixed quota first. The Agent ingests the evidence, decides whether clarification would change the path, synthesizes concepts and prerequisites, and then mutates the stored learning model. This execution is live through Gemini 3.5 Flash and Google ADK on Cloud Run.

**If a clarification appears:** Answer it briefly and say:

> The question is not from a fixed intake form. The Agent asks it only because the answer changes the plan.

## 1:30-2:15 — Generated rhythm and learner control

**Screen:** Show the concise plan, the collapsed audit-trail control, reminder actions, and **Review plan**. Open plan review. Move one slider slightly, then show **More settings** without changing everything.

**Voiceover:**

> The result is not just prose. The Agent creates an editable goal, themes, a continuous steady-to-sprint priority, a session-duration range, reminder frequency, study pattern, and energy window. The full report remains available for audit, but the learner sees the actionable plan first. A calendar or browser reminder is optional, and missing it never creates overdue work. Most importantly, generating the plan does not start practice. I review the assumptions and explicitly start the session.

## 2:15-2:55 — Retrieval and feedback loop

**Screen:** Select **Start this session**. Show the Agent-selected retrieval. Provide a short answer or select the appropriate outcome, complete memory feedback, and show the before-and-after rhythm or revised next reminder.

**Voiceover:**

> NoteFlow now selects one retrieval from the learner's goal and memory evidence. The attempt outcome, hint depth, reaction time, and memory feedback return to the same signed Agent session. The Agent can change future timing, load, knowledge scope, and the next reminder. Here the interface makes that mutation visible before and after, so the learner can inspect what changed and why.

## 2:55-3:37 — Google Cloud proof of action

**Screen:** Switch to Google Cloud Console. Show, in this order:

1. Cloud Run services for the interactive Agent and private worker.
2. The active interactive revision and healthy traffic.
3. Firestore current model plus an immutable version, such as `9aPqpj5FpIXwgGf89HVQ` or `8DopLuEwDZ4SVnk4eqyn`.
4. Pub/Sub topic or message evidence for `21517632790505643`.
5. Private worker log or Firestore background record showing `complete`.

**Voiceover:**

> This is the deployed Google Cloud backend. The interactive Google ADK service and a separate private worker run on Cloud Run. The Agent writes a current model and immutable versions to Firestore. For deeper work it sends only a safe digest through Pub/Sub; an OIDC-authenticated worker completes the analysis and writes the result back to Firestore. This verified run persisted mutation 9aPqpj5FpIXwgGf89HVQ, published message 21517632790505643, and reached complete status. No Google credentials or shared service secret are sent to the browser.

## 3:37-3:55 — Architecture, reproducibility, and close

**Screen:** Public GitHub README and architecture diagram.

**Voiceover:**

> The public repository includes the architecture, trust boundaries, local and cloud setup, dated development log, and an explicit pre-existing-work disclosure. NoteFlow Agent turns learning context into a sustainable rhythm, one retrieval, and real evidence that improves what comes next. Plan the rhythm. Enter the Flow. Remember.

## Upload checklist

- [ ] Final duration is no more than 4:00.
- [ ] The video is publicly visible on YouTube or Vimeo, not private or unlisted.
- [ ] Spoken language is English, or accurate English subtitles are included.
- [ ] The problem, value proposition, and live application are visible.
- [ ] The Agent execution is shown unedited.
- [ ] Cloud Run, Firestore, Pub/Sub, and worker completion are visible.
- [ ] No secret, token, environment-variable value, billing detail, private note, or personal identifier is visible.
- [ ] The video description states that it was created for the 2026 All Things Agentic Hackathon.
- [ ] The final public URL replaces the placeholder in `DEVPOST_SUBMISSION_DRAFT.md`.
