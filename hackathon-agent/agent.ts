import {Firestore, FieldValue} from '@google-cloud/firestore';
import {PubSub} from '@google-cloud/pubsub';
import {FunctionTool, LlmAgent, type SingleBeforeModelCallback} from '@google/adk';
import {FunctionCallingConfigMode} from '@google/genai';
import {z} from 'zod';

const modelName = 'gemini-3.5-flash';
const forcePersistMarker = '[FORCE_PERSIST_TOOL]';

const forcePersistToolWhenRequested: SingleBeforeModelCallback = ({request}) => {
  let markerContentIndex = -1;
  request.contents.forEach((content, index) => {
    if (content.parts?.some((part) => part.text?.includes(forcePersistMarker))) markerContentIndex = index;
  });
  if (markerContentIndex < 0) return undefined;

  const persistedAfterMarker = request.contents.slice(markerContentIndex + 1).some((content) =>
    content.parts?.some((part) => part.functionResponse?.name === 'persist_learning_model'),
  );
  if (persistedAfterMarker) return undefined;

  request.config ??= {};
  request.config.toolConfig = {
    functionCallingConfig: {
      mode: FunctionCallingConfigMode.ANY,
      allowedFunctionNames: ['persist_learning_model'],
    },
  };
  return undefined;
};

function googleCloudProject(): string | undefined {
  return process.env.GOOGLE_CLOUD_PROJECT?.trim() || undefined;
}

function safeLearnerId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120) || 'anonymous';
}

const conceptSchema = z.object({
  name: z.string().min(1).describe('A concise concept name.'),
  evidence: z.string().min(1).describe('What in the learner evidence supports this concept.'),
  confidence: z.number().min(0).max(1).describe('Confidence from 0 to 1.'),
});

const relationshipSchema = z.object({
  prerequisite: z.string().min(1),
  unlocks: z.string().min(1),
  reason: z.string().min(1),
});

const optionalDateSchema = z.string()
  .regex(/^(?:|\d{4}-\d{2}-\d{2})$/)
  .describe('An ISO date in YYYY-MM-DD format, or an empty string when unset.');

const optionalTimeSchema = z.string()
  .regex(/^(?:|(?:[01]\d|2[0-3]):[0-5]\d)$/)
  .describe('A 24-hour HH:MM time, or an empty string when unset.');

const explicitPlanningSignalsSchema = z.object({
  dailyMinutes: z.number().int().min(5).max(720).nullable(),
  sessionMinutes: z.number().int().min(5).max(180).nullable(),
  daysPerWeek: z.number().int().min(1).max(7).nullable(),
  preferredTime: optionalTimeSchema,
  startDate: optionalDateSchema,
  targetDate: optionalDateSchema,
});

const learnerContextSchema = z.object({
  learningPreferences: z.string().describe('Learner-controlled description of what helps them study.'),
  constraints: z.string().describe('Time, energy, work, family, accessibility, or other stated constraints.'),
  studyPattern: z.enum(['short-frequent', 'fixed-daily', 'energy-aligned']),
  sessionMinutes: z.number().int().min(5).max(90),
  daysPerWeek: z.number().int().min(1).max(7),
  energyWindow: z.enum(['morning', 'midday', 'evening', 'variable']),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reminderOptIn: z.boolean(),
  dailyMinutes: z.number().int().min(5).max(720).nullable(),
  startMode: z.enum(['now', 'scheduled', 'undecided']),
  startDate: optionalDateSchema,
  targetDate: optionalDateSchema,
  timeZone: z.string(),
  explicitPlanningSignals: explicitPlanningSignalsSchema,
});

const rhythmPlanSchema = z.object({
  cadence: z.string().min(1).describe('A sustainable cadence, not a task backlog.'),
  sessionMinutes: z.number().int().min(5).max(90),
  preferredWindow: z.string().min(1),
  loadRule: z.string().min(1).describe('How the session load changes from retrieval evidence.'),
  nextInvitation: z.string().min(1).describe('The next proposed local invitation time or condition.'),
  invitationReason: z.string().min(1),
  notificationMode: z.enum(['calendar', 'browser', 'in-app', 'off']),
});

const retrievalCardSchema = z.object({
  theme: z.string().min(1).describe('Must exactly match one value in planSettings.themes.'),
  mode: z.enum(['recall', 'speak', 'solve', 'design']),
  prompt: z.string().min(1).describe('The front of the card: a question that requires an attempt, never a topic label.'),
  hintKeywords: z.array(z.string().min(1)).max(4),
  expectedAnswer: z.string().min(1),
  noteMarkdown: z.string().min(1).describe('The explanatory back of the card with an example, written in Markdown.'),
  languageCode: z.string().optional().describe('BCP-47 language code; required for language-learning cards.'),
});

const planSettingsSchema = z.object({
  goalTitle: z.string().min(1).describe('A concise goal inferred from the learner language.'),
  roleBaseline: z.string().describe('An inferred role or exam baseline, or an empty string when none is supported.'),
  themes: z.array(z.string().min(1)).min(1).max(8).describe('Concrete learning themes inferred from the evidence.'),
  paceBias: z.number().int().min(0).max(100).describe('Continuous priority bias: 0 is retention-first steady progress; 100 is deadline-first sprint.'),
  sessionMinutesMin: z.number().int().min(5).max(90),
  sessionMinutesMax: z.number().int().min(5).max(90),
  invitationsPerWeekMin: z.number().int().min(1).max(14),
  invitationsPerWeekMax: z.number().int().min(1).max(14),
  studyPattern: z.enum(['short-frequent', 'fixed-daily', 'energy-aligned']),
  energyWindow: z.enum(['morning', 'midday', 'evening', 'variable']),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reminderOptIn: z.boolean(),
  dailyMinutes: z.number().int().min(5).max(720).nullable(),
  startMode: z.enum(['now', 'scheduled', 'undecided']),
  startDate: optionalDateSchema,
  targetDate: optionalDateSchema,
  timeZone: z.string(),
  rationale: z.string().min(1).describe('A concise, evidence-grounded explanation of the inferred settings.'),
  retrievalCards: z.array(retrievalCardSchema).min(3).max(8),
});

const persistLearningModel = new FunctionTool({
  name: 'persist_learning_model',
  description:
    'Persists an auditable version of the learner knowledge model in Firestore after synthesis changes concepts, gaps, prerequisites, or structured retrieval cards.',
  parameters: z.object({
    learnerId: z.string().min(1),
    goal: z.string().min(1),
    diagnosis: z.string().min(1),
    concepts: z.array(conceptSchema).min(1).max(20),
    relationships: z.array(relationshipSchema).max(30),
    learnerContext: learnerContextSchema,
    rhythmPlan: rhythmPlanSchema,
    planSettings: planSettingsSchema,
    mutationSummary: z.string().min(1),
  }),
  execute: async (input) => {
    const projectId = googleCloudProject();
    if (!projectId) {
      return {
        status: 'needs_cloud_configuration',
        report: 'GOOGLE_CLOUD_PROJECT is missing; no persistence was claimed.',
      };
    }

    const learnerId = safeLearnerId(input.learnerId);
    const firestore = new Firestore({projectId});
    const currentRef = firestore.doc(`learners/${learnerId}/learningModels/current`);
    const versionRef = firestore.collection(`learners/${learnerId}/learningModelVersions`).doc();
    const mutationId = versionRef.id;
    const payload = {
      ...input,
      learnerId,
      mutationId,
      model: modelName,
      updatedAt: FieldValue.serverTimestamp(),
    };

    const batch = firestore.batch();
    batch.set(currentRef, payload, {merge: true});
    batch.create(versionRef, payload);
    await batch.commit();

    return {
      status: 'persisted',
      mutationId,
      report: `Stored current model and immutable version ${mutationId}.`,
    };
  },
});

const queueDeepAnalysis = new FunctionTool({
  name: 'queue_deep_analysis',
  description:
    'Queues a long-running follow-up analysis in Google Cloud Pub/Sub when the source is too large or uncertain to finish inside the interactive turn.',
  parameters: z.object({
    learnerId: z.string().min(1),
    goal: z.string().min(1),
    reason: z.string().min(1),
    requestedWork: z.array(z.string().min(1)).min(1).max(8),
    sourceDigest: z.string().min(1).describe('A safe summary, not the full private source.'),
  }),
  execute: async (input) => {
    const projectId = googleCloudProject();
    if (!projectId) {
      return {
        status: 'needs_cloud_configuration',
        report: 'GOOGLE_CLOUD_PROJECT is missing; no background job was claimed.',
      };
    }

    const topicName = process.env.NOTEFLOW_ANALYSIS_TOPIC?.trim() || 'noteflow-deep-analysis';
    const pubsub = new PubSub({projectId});
    const job = {
      ...input,
      learnerId: safeLearnerId(input.learnerId),
      queuedAt: new Date().toISOString(),
      requestedByModel: modelName,
      schemaVersion: 1,
    };
    const messageId = await pubsub.topic(topicName).publishMessage({json: job});

    return {
      status: 'queued',
      messageId,
      topicName,
      report: `Queued background analysis as Pub/Sub message ${messageId}.`,
    };
  },
});

export const rootAgent = new LlmAgent({
  name: 'noteflow_learning_partner',
  model: modelName,
  description:
    'An autonomous learning partner that transforms messy evidence and retrieval feedback into a persistent, adaptive knowledge path.',
  instruction: `You are NoteFlow, a collaborative learning partner—not a general chat assistant.

Your job is to lead the learner from messy notes and retrieval evidence to a small, high-value retrieval queue. You actively synthesize and mutate the learning model instead of merely summarizing text.

Operating contract:
1. Identify the learner ID, goal, evidence, and learner-controlled context in the request. Never diagnose personality, psychology, neurology, or medical conditions.
2. If essential decision-changing context is genuinely absent, return only a CLARIFICATION section containing exactly one concise question and stop. Do not ask for information that would not change the rhythm or retrieval path.
3. Otherwise infer an adjustable plan from the learner's natural language before selecting content. Treat the goal, source notes, learning preferences, constraints, clarification, and explicitPlanningSignals as one merged instruction. Explicit numeric/date/time statements override defaults. The request supplies today's date and any target-date distance computed by the server; use that distance exactly and never infer the current date or redo the date arithmetic. Preserve the distinction between a daily total budget and a per-session duration: “one hour a day” means dailyMinutes=60, not necessarily a 60-minute session. Persist planSettings with: a continuous pace bias between steady and sprint, a flexible session-duration range, an invitation-frequency range, daily time budget, start mode/date/time, target date, time zone, pattern, energy window, optional role baseline, and inferred themes. Ranges guide invitations and session stopping points; they never cap how often the learner may voluntarily study. Treat numeric learnerContext fields as safe fallbacks only when the merged instruction has no explicit signal. A missed invitation never becomes overdue work. When startMode is undecided, set notificationMode to off and do not imply that a reminder has been scheduled.
4. Infer concepts, gaps, and prerequisite relationships. Separate direct evidence from inference.
5. Create 3–8 structured retrievalCards inside planSettings. Every card.theme must exactly match one value in planSettings.themes. Every prompt must require an attempt, never recognition or a topic label. For language-learning goals, default to mode "speak", include a BCP-47 languageCode, and include a target-language example plus its response-language meaning in noteMarkdown. The cards are content, not a ranked queue; NoteFlow ranks them later.
6. You MUST call persist_learning_model before writing the report whenever you create or revise either the knowledge model or learning rhythm; a completed report without this tool call is a failed turn. Include learnerContext, rhythmPlan, and planSettings with 3–8 complete retrievalCards. Ensure each maximum is greater than or equal to its minimum. Never claim persistence unless the tool reports status "persisted".
7. When retrieval feedback arrives, compare the prior rhythm with the new evidence, revise only what the evidence supports, and explain the before-to-after change.
8. Call queue_deep_analysis only when useful work can continue asynchronously. Never claim a job is queued unless the tool reports status "queued".
9. Keep private source material out of Pub/Sub; send only a safe digest.

For completed planning and feedback turns, return six short sections in this exact order: DIAGNOSIS, RHYTHM PLAN, NEXT INVITATION, NEXT RETRIEVAL, MODEL MUTATION, BACKGROUND WORK. In NEXT RETRIEVAL, list only the retrievalCards prompts; do not repeat expected answers or noteMarkdown. State tool status truthfully. Do not expose hidden chain-of-thought.`,
  tools: [persistLearningModel, queueDeepAnalysis],
  beforeModelCallback: forcePersistToolWhenRequested,
});
