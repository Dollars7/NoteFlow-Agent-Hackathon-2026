import {Firestore, FieldValue} from '@google-cloud/firestore';
import {GoogleGenAI} from '@google/genai';
import {createServer} from 'node:http';

const port = Number.parseInt(process.env.PORT || '8080', 10);
const model = 'gemini-3.5-flash';

function send(response, status, payload) {
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8'});
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function decodePushMessage(envelope) {
  const message = envelope?.message;
  if (!message?.data || typeof message.data !== 'string') {
    throw new Error('A Pub/Sub push envelope with base64 message.data is required.');
  }
  const job = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
  return {job, messageId: message.messageId || message.message_id || crypto.randomUUID()};
}

async function analyzeInBackground(job, messageId) {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'us-central1';
  if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is required.');
  if (!job?.learnerId || !job?.goal || !job?.sourceDigest) {
    throw new Error('The queued job is missing learnerId, goal, or sourceDigest.');
  }

  const ai = new GoogleGenAI({vertexai: true, project, location});
  const response = await ai.models.generateContent({
    model,
    contents: [
      'You are the asynchronous analysis worker for NoteFlow.',
      'Use only the safe digest below. Do not infer personal data.',
      `Goal: ${job.goal}`,
      `Reason: ${job.reason}`,
      `Requested work: ${JSON.stringify(job.requestedWork)}`,
      `Safe source digest: ${job.sourceDigest}`,
      'Return concise JSON-compatible prose with: prerequisite_candidates, misconceptions_to_test, and next_session_adjustment.',
    ].join('\n\n'),
  });

  const learnerId = String(job.learnerId).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  const firestore = new Firestore({projectId: project});
  await firestore.doc(`learners/${learnerId}/backgroundAnalyses/${messageId}`).set({
    status: 'complete',
    model,
    goal: job.goal,
    requestedWork: job.requestedWork,
    sourceDigest: job.sourceDigest,
    result: response.text || '',
    completedAt: FieldValue.serverTimestamp(),
  });
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/healthz') {
    send(response, 200, {status: 'ok', worker: 'noteflow-analysis'});
    return;
  }
  if (request.method !== 'POST') {
    send(response, 404, {error: 'Not found'});
    return;
  }

  try {
    const {job, messageId} = decodePushMessage(await readJson(request));
    await analyzeInBackground(job, messageId);
    send(response, 204, {});
  } catch (error) {
    console.error('background_analysis_failed', error);
    send(response, 500, {
      error: error instanceof Error ? error.message : 'Background analysis failed.',
    });
  }
});

server.listen(port, () => {
  console.log(`NoteFlow background worker listening on ${port}.`);
});
