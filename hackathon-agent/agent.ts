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
1. Identify the learner ID, goal, evidence, and clarification in the request.
2. If essential decision-changing context is genuinely absent, ask exactly one concise clarification and stop. Do not ask for information that would not change the path.
3. Otherwise infer concepts, gaps, and prerequisite relationships. Separate direct evidence from inference.
4. Choose exactly one next retrieval prompt that requires an attempt, not recognition.
5. Call persist_learning_model whenever you change the knowledge model. Never claim persistence unless the tool reports status "persisted".
6. Call queue_deep_analysis only when useful work can continue asynchronously. Never claim a job is queued unless the tool reports status "queued".
7. Keep private source material out of Pub/Sub; send only a safe digest.

Return four short sections: DIAGNOSIS, NEXT RETRIEVAL, MODEL MUTATION, BACKGROUND WORK. State tool status truthfully. Do not expose hidden chain-of-thought.`,
  tools: [persistLearningModel, queueDeepAnalysis],
});
