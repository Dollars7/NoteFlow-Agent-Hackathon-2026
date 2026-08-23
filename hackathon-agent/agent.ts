import {Firestore, FieldValue} from '@google-cloud/firestore';
import {PubSub} from '@google-cloud/pubsub';
import {FunctionTool, LlmAgent} from '@google/adk';
import {z} from 'zod';

const modelName = 'gemini-3.5-flash';

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

const learnerContextSchema = z.object({
  learningPreferences: z.string().describe('Learner-controlled description of what helps them study.'),
  constraints: z.string().describe('Time, energy, work, family, accessibility, or other stated constraints.'),
  studyPattern: z.enum(['short-frequent', 'fixed-daily', 'energy-aligned']),
  sessionMinutes: z.number().int().min(5).max(90),
  daysPerWeek: z.number().int().min(1).max(7),
  energyWindow: z.enum(['morning', 'midday', 'evening', 'variable']),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reminderOptIn: z.boolean(),
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

const persistLearningModel = new FunctionTool({
  name: 'persist_learning_model',
  description:
    'Persists an auditable version of the learner knowledge model in Firestore after synthesis changes concepts, gaps, prerequisites, or the next retrieval prompt.',
  parameters: z.object({
    learnerId: z.string().min(1),
    goal: z.string().min(1),
    diagnosis: z.string().min(1),
    concepts: z.array(conceptSchema).min(1).max(20),
    relationships: z.array(relationshipSchema).max(30),
    learnerContext: learnerContextSchema,
    rhythmPlan: rhythmPlanSchema,
    nextRetrievalPrompt: z.string().min(1),
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

Your job is to lead the learner from messy notes and retrieval evidence to exactly one high-value next retrieval move. You actively synthesize and mutate the learning model instead of merely summarizing text.

Operating contract:
1. Identify the learner ID, goal, evidence, and learner-controlled context in the request. Never diagnose personality, psychology, neurology, or medical conditions.
2. If essential decision-changing context is genuinely absent, return only a CLARIFICATION section containing exactly one concise question and stop. Do not ask for information that would not change the rhythm or retrieval path.
3. Otherwise create a sustainable rhythm before selecting content. Respect the requested pattern, energy window, available days, session length, constraints, and reminder opt-in. A missed invitation never becomes overdue work.
4. Infer concepts, gaps, and prerequisite relationships. Separate direct evidence from inference.
5. Choose exactly one next retrieval prompt that requires an attempt, not recognition.
6. Call persist_learning_model whenever you create or revise either the knowledge model or learning rhythm. Include learnerContext and rhythmPlan. Never claim persistence unless the tool reports status "persisted".
7. When retrieval feedback arrives, compare the prior rhythm with the new evidence, revise only what the evidence supports, and explain the before-to-after change.
8. Call queue_deep_analysis only when useful work can continue asynchronously. Never claim a job is queued unless the tool reports status "queued".
9. Keep private source material out of Pub/Sub; send only a safe digest.

For completed planning and feedback turns, return six short sections in this exact order: DIAGNOSIS, RHYTHM PLAN, NEXT INVITATION, NEXT RETRIEVAL, MODEL MUTATION, BACKGROUND WORK. State tool status truthfully. Do not expose hidden chain-of-thought.`,
  tools: [persistLearningModel, queueDeepAnalysis],
});
