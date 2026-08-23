# NoteFlow Agent architecture

The hackathon entry separates the pre-existing web foundation from the contest-period Google agent system.

```mermaid
flowchart LR
    Learner["Learner · messy notes + retrieval feedback"]
    Web["NoteFlow /hackathon UI<br/>public judge experience"]
    Demo["NoteFlow /demo<br/>full guest learning workspace"]
    Proxy["Same-origin server proxy<br/>rate-limited + server-only token"]
    API["ADK API server<br/>Cloud Run"]
    Agent["NoteFlow Learning Partner<br/>Google ADK + Gemini 3.5 Flash"]
    Persist["persist_learning_model tool"]
    Queue["queue_deep_analysis tool"]
    Firestore[("Firestore<br/>current model + immutable versions")]
    PubSub[["Pub/Sub<br/>deep-analysis jobs"]]
    Worker["Background analysis worker<br/>Cloud Run"]

    Learner --> Web
    Web --> Demo
    Web --> Proxy
    Proxy -->|"authenticated ADK session + /run"| API
    API --> Agent
    Agent --> Persist
    Agent --> Queue
    Persist --> Firestore
    Queue --> PubSub
    PubSub --> Worker
    Worker --> Firestore
    Firestore -->|"next session context"| Agent
    Agent -->|"one diagnosis + one retrieval move"| Web
    Demo -->|"attempt outcome + memory feedback"| Proxy
    Proxy -->|"HMAC-signed session continuation"| API
```

## Trust boundaries

- The browser never receives Gemini or Google Cloud credentials.
- The browser also never receives the Cloud Run bearer token or service URL; the same-origin server proxy holds both as runtime values.
- Cloud Run uses its service identity and Application Default Credentials.
- Pub/Sub messages contain only a safe source digest, not raw private notes.
- Each model mutation writes a current document and a separate immutable version.
- The public browser receives only an HMAC-signed continuation token, never the Cloud Run shared secret; it can continue only its high-entropy judge session.
- Learner context and rhythm are versioned with the knowledge model. Retrieval feedback re-enters the same ADK session and produces a visible before-and-after rhythm change.
- The interface labels deterministic preview output and never presents it as Gemini output.
- The public `/demo` route exposes the pre-existing retrieval-first learning workspace without requiring a judge account; its data remains on that browser.

## Contest technology mapping

| Requirement | Implementation |
| --- | --- |
| Gemini 3.5+ | `gemini-3.5-flash` through Vertex AI |
| Google Agent Framework | Google ADK for TypeScript |
| Google Cloud infrastructure | Cloud Run, Firestore, and Pub/Sub |
| Beyond a chat loop | Tool-driven knowledge mutation and asynchronous background analysis |
| Captures feedback | Signed clarification and retrieval-feedback continuations, persistent model/rhythm versions, and visible before/after changes |
