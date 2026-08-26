import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

let loadedWorker;

const testAuthEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://noteflow-test.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_noteflow_test",
};

function createFakeDb() {
  const rows = new Map();

  return {
    prepare(query) {
      let values = [];
      const statement = {
        bind(...nextValues) {
          values = nextValues;
          return statement;
        },
        async first() {
          if (!query.startsWith("SELECT payload")) return null;
          const payload = rows.get(values[0]);
          return payload === undefined ? null : { payload };
        },
        async all() {
          return { results: [], success: true };
        },
        async run() {
          if (query.startsWith("INSERT INTO workspace_state")) {
            rows.set(values[0], values[1]);
          }
          return { success: true };
        },
      };
      return statement;
    },
    async batch() {
      return [];
    },
  };
}

async function dispatch(request, db = createFakeDb(), env = {}) {
  if (!loadedWorker) {
    const workerUrl = new URL("../dist/server/index.js", import.meta.url);
    workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
    ({ default: loadedWorker } = await import(workerUrl.href));
  }

  return loadedWorker.fetch(
    request,
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      DB: db,
      ...env,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function installSupabaseUserMock() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.origin === testAuthEnv.NEXT_PUBLIC_SUPABASE_URL && url.pathname === "/auth/v1/user") {
      const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      const users = {
        "token-alice": { id: "user-alice", email: "alice@example.com" },
        "token-bob": { id: "user-bob", email: "bob@example.com" },
      };
      const user = users[token];
      if (!user) return Response.json({ message: "Invalid JWT" }, { status: 401 });
      return Response.json({
        ...user,
        aud: "authenticated",
        role: "authenticated",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {},
        identities: [],
        created_at: "2026-07-23T00:00:00.000Z",
      });
    }
    return originalFetch(input, init);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

async function render(path = "/") {
  return dispatch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }));
}

test("server-renders the public hackathon product without a login gate", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>NoteFlow Agent/);
  assert.match(html, /Your notes should notice where you get stuck/);
  assert.match(html, /Build my learning path/);
  assert.match(html, /Try the learning workspace/);
  assert.match(html, />EN</);
  assert.match(html, />中文</);
  assert.doesNotMatch(html, /Continue with Google|NEXT_PUBLIC_SUPABASE_URL/);
});

test("keeps the unconfigured personal account honest and optional", async () => {
  const response = await render("/account");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Guest learning is ready/);
  assert.match(html, /Enter guest learning/);
  assert.doesNotMatch(html, /Continue with Google|Send verification code|NEXT_PUBLIC_SUPABASE_URL/);
});

test("isolates D1 workspace state by verified Supabase user id", async () => {
  const restoreFetch = installSupabaseUserMock();
  const db = createFakeDb();
  const requestFor = (token, method = "GET", body) =>
    new Request("http://localhost/api/state", {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body,
    });

  try {
    const aliceWrite = await dispatch(
      requestFor("token-alice", "PUT", JSON.stringify({ owner: "alice" })),
      db,
      testAuthEnv,
    );
    const bobWrite = await dispatch(
      requestFor("token-bob", "PUT", JSON.stringify({ owner: "bob" })),
      db,
      testAuthEnv,
    );
    assert.equal(aliceWrite.status, 200);
    assert.equal(bobWrite.status, 200);

    const aliceRead = await dispatch(requestFor("token-alice"), db, testAuthEnv);
    const bobRead = await dispatch(requestFor("token-bob"), db, testAuthEnv);
    assert.deepEqual(await aliceRead.json(), { state: { owner: "alice" } });
    assert.deepEqual(await bobRead.json(), { state: { owner: "bob" } });

    const invalid = await dispatch(requestFor("invalid-token"), db, testAuthEnv);
    assert.equal(invalid.status, 401);

    const anonymous = await dispatch(
      new Request("http://localhost/api/state", { headers: { accept: "application/json" } }),
      db,
      testAuthEnv,
    );
    assert.equal(anonymous.status, 401);
  } finally {
    restoreFetch();
  }
});

test("implements dual auth, unified notes, scoped scheduling, and private persistence", async () => {
  const [
    serverPage,
    accountPage,
    authGate,
    serverAuth,
    clientApp,
    engine,
    noteLibrary,
    importer,
    apiRoute,
    schema,
    hosting,
    packageJson,
  ] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth-gate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/noteflow-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/flow-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/note-library.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/import-notes.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(serverPage, /hackathon\/page/);
  assert.match(accountPage, /AuthGate/);
  assert.match(authGate, /signInWithOAuth/);
  assert.match(authGate, /provider: "google"/);
  assert.match(authGate, /signInWithOtp/);
  assert.match(authGate, /verifyOtp/);
  assert.match(authGate, /type: "email"/);
  assert.match(authGate, /使用 Google 继续/);
  assert.match(authGate, /发送验证码/);
  assert.match(serverAuth, /auth\.getUser\(token\)/);
  assert.match(serverAuth, /persistSession: false/);

  assert.match(engine, /type NoteCard/);
  assert.match(engine, /tags: string\[\]/);
  assert.match(engine, /focusSkillIds/);
  assert.match(engine, /sprintUrgency/);
  assert.match(engine, /recordSilentSkip/);
  assert.match(engine, /skipCount >= 3/);

  assert.match(clientApp, /hint-keywords/);
  assert.match(clientApp, /hint-scaffold/);
  assert.match(clientApp, /MediaRecorder/);
  assert.match(clientApp, /刚才卡在哪一句/);
  assert.match(clientApp, /是否继续不会进入调度权重/);
  assert.match(clientApp, /authorization: `Bearer \$\{accessToken\}`/);
  assert.match(clientApp, /noteflow-memory-v4/);
  assert.match(clientApp, /deletedCardIds/);
  assert.match(clientApp, /bulkAddTag/);

  assert.match(noteLibrary, /一个对象 · 两个视图/);
  assert.match(noteLibrary, /Markdown 笔记 · 卡片背面/);
  assert.match(noteLibrary, /批量移动到/);
  assert.match(noteLibrary, /导入 CSV 或 Anki 文件/);
  assert.match(importer, /front.*back.*tags/i);
  assert.match(importer, /parseRows/);

  assert.match(apiRoute, /`supabase:\$\{user\.id\}`/);
  assert.match(apiRoute, /authenticateRequest\(request\)/);
  assert.match(apiRoute, /Authentication required/);
  assert.match(apiRoute, /ON CONFLICT\(id\) DO UPDATE/);
  assert.doesNotMatch(apiRoute, /workspaceId = "default"/);
  assert.match(schema, /workspace_state/);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, null);
  assert.match(hostingConfig.project_id, /^appgprj_/);

  assert.doesNotMatch(clientApp, /availableMinutes|completedIds|Decision receipt/);
  assert.doesNotMatch(engine, /sessionLength|willingnessToContinue/);
  assert.match(packageJson, /@supabase\/supabase-js/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/chatgpt-auth.ts", import.meta.url)));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

test("defaults to English, keeps Chinese in place, and reviews Agent plans before practice", async () => {
  const [layout, localeSource, hackathonHeader, hackathonDemo, guestWorkspace, clientApp, goalPlanner, handoff, proxy] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/locale.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/hackathon/hackathon-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/hackathon/hackathon-demo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/demo/guest-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/noteflow-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/goal-planner.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/hackathon-handoff.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/hackathon-agent/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /<html lang="en">/);
  assert.match(layout, /LocaleProvider/);
  assert.match(localeSource, /useState<Locale>\("en"\)/);
  assert.match(localeSource, /noteflow-locale/);
  assert.match(localeSource, /document\.documentElement\.lang/);
  assert.match(hackathonHeader, /LanguageSwitch/);
  assert.match(hackathonHeader, /Try the learning workspace/);
  assert.match(hackathonHeader, /体验学习空间/);
  assert.match(hackathonDemo, /Your notes should notice where you get stuck/);
  assert.match(hackathonDemo, /你的笔记应该知道你卡在哪里/);
  assert.match(hackathonDemo, /Generating your learning rhythm/);
  assert.match(hackathonDemo, /Step \$\{visibleProgressStep\} of 4/);
  assert.match(hackathonDemo, /MarkdownReport/);
  assert.match(hackathonDemo, /<em key=\{index\}>/);
  assert.match(hackathonDemo, /markdownDownloadHref/);
  assert.match(hackathonDemo, /download="noteflow-learning-plan\.md"/);
  assert.match(hackathonDemo, /Download full report/);
  assert.match(hackathonDemo, /Start in your own words/);
  assert.match(hackathonDemo, /What are you learning or getting stuck on/);
  assert.match(hackathonDemo, /evidenceMissing/);
  assert.match(hackathonDemo, /More settings/);
  assert.match(hackathonDemo, /Agent details and audit trail/);
  assert.match(hackathonDemo, /Study reminders/);
  assert.match(hackathonDemo, /Review plan/);
  assert.match(hackathonDemo, /Does not start the session yet/);
  assert.match(hackathonDemo, /Add reminder to calendar/);
  assert.match(hackathonDemo, /Notification\.requestPermission/);
  assert.match(hackathonDemo, /hackathonHandoffKey/);
  assert.match(guestWorkspace, /Guest learner/);
  assert.match(guestWorkspace, /agentHandoff/);
  assert.match(guestWorkspace, /setLocale\(parsed\.locale\)/);
  assert.match(clientApp, /agentHandoff\.nextRetrievalPrompt/);
  assert.match(clientApp, /syncAgentFeedback/);
  assert.match(clientApp, /Visible plan mutation/);
  assert.match(clientApp, /moveCurrentCardToEnd/);
  assert.match(clientApp, /Later this session · move to queue end/);
  assert.match(clientApp, /Skip for now · return to learning pool/);
  assert.match(clientApp, /setPhase\("pre"\)/);
  assert.match(goalPlanner, /type="range"/);
  assert.match(goalPlanner, /Steady to sprint priority/);
  assert.match(goalPlanner, /Session length/);
  assert.match(goalPlanner, /Study reminder frequency/);
  assert.match(goalPlanner, /planner-more-settings/);
  assert.match(goalPlanner, /never limit learning you start yourself/);
  assert.match(handoff, /type LearnerContext/);
  assert.match(handoff, /type GeneratedPlanSettings/);
  assert.match(handoff, /extractGeneratedPlan/);
  assert.match(handoff, /type RhythmRevision/);
  assert.match(handoff, /extractNextRetrieval/);
  assert.match(proxy, /Response language/);
  assert.match(proxy, /Simplified Chinese only/);
  assert.match(proxy, /English only/);
  assert.match(proxy, /continuationSignature/);
  assert.match(proxy, /action === "feedback"/);
});
