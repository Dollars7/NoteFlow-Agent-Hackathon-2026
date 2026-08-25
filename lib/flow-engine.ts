export type GoalId = "amazon-sde2" | "google-l4";

export type GoalProfile = {
  title: string;
  baseGoal: GoalId;
  roleBaseline: string;
  themes: string[];
  paceBias: number;
  sessionMinutesMin: number;
  sessionMinutesMax: number;
  invitationsPerWeekMin: number;
  invitationsPerWeekMax: number;
  studyPattern: "short-frequent" | "fixed-daily" | "energy-aligned";
  energyWindow: "morning" | "midday" | "evening" | "variable";
  preferredTime: string;
  reminderOptIn: boolean;
  sprintDeadline: string;
  focusSkillIds: string[];
};

export type SkillState = {
  id: string;
  name: string;
  mastery: number;
  retention: number;
  expression: number;
  confidence: number;
};

export type RetrievalMode = "recall" | "solve" | "speak" | "design";
export type MemoryFeedback = "guided" | "prerequisite" | "overlearned";

export type NoteCard = {
  id: string;
  skillId: string;
  tags: string[];
  prerequisiteCardId?: string;
  mode: RetrievalMode;
  title: string;
  prompt: string;
  hintKeywords: string[];
  scaffold: string[];
  noteMarkdown: string;
  goalRelevance: Record<GoalId, number>;
  dependencyValue: number;
  uncertainty: number;
};

export type CardMemory = {
  intervalScale: number;
  skipCount: number;
  needsSplit: boolean;
  prerequisiteNeeded: boolean;
};

export type RetrievalEvidence = {
  cardId: string;
  attemptOutcome: "fluent" | "stuck";
  feedback: MemoryFeedback;
  hintDepth: 0 | 1 | 2;
  reactionMs: number;
  recordedAt: string;
};

export type MemoryDelta = {
  skillName: string;
  metric: "retention" | "expression";
  before: number;
  after: number;
  message: string;
};

type RankedCard = NoteCard & {
  hiddenPriority: number;
};

export const goals: Record<GoalId, { label: string; shortLabel: string }> = {
  "amazon-sde2": { label: "Amazon · SDE II", shortLabel: "Amazon" },
  "google-l4": { label: "Google · L4 SWE", shortLabel: "Google" },
};

export const defaultGoalProfile: GoalProfile = {
  title: "Amazon SDE II",
  baseGoal: "amazon-sde2",
  roleBaseline: "Amazon · SDE II",
  themes: ["Intervals", "Object Design", "Technical English", "Spring / JWT", "Graphs"],
  paceBias: 25,
  sessionMinutesMin: 10,
  sessionMinutesMax: 25,
  invitationsPerWeekMin: 3,
  invitationsPerWeekMax: 5,
  studyPattern: "short-frequent",
  energyWindow: "evening",
  preferredTime: "19:00",
  reminderOptIn: false,
  sprintDeadline: "",
  focusSkillIds: [],
};

export const skillScopes = [
  { id: "intervals", label: "Intervals" },
  { id: "ood", label: "Object Design" },
  { id: "expression", label: "Technical English" },
  { id: "spring", label: "Spring / JWT" },
  { id: "graph", label: "Graphs" },
] as const;

export const initialSkills: SkillState[] = [
  { id: "intervals", name: "Intervals", mastery: 0.72, retention: 0.48, expression: 0.61, confidence: 0.74 },
  { id: "ood", name: "Object Design", mastery: 0.34, retention: 0.58, expression: 0.29, confidence: 0.49 },
  { id: "expression", name: "Technical English", mastery: 0.52, retention: 0.67, expression: 0.27, confidence: 0.46 },
  { id: "spring", name: "Spring / JWT", mastery: 0.66, retention: 0.51, expression: 0.43, confidence: 0.63 },
  { id: "graph", name: "Graphs", mastery: 0.57, retention: 0.71, expression: 0.49, confidence: 0.68 },
];

export const noteCards: NoteCard[] = [
  {
    id: "interval-overlap",
    skillId: "intervals",
    tags: ["intervals", "fundamentals"],
    mode: "recall",
    title: "When do two intervals overlap?",
    prompt: "State the overlap condition without drawing a timeline. Then explain why it works.",
    hintKeywords: ["later start", "earlier end", "strict inequality"],
    scaffold: [
      "Choose the later of the two start times.",
      "Choose the earlier of the two end times.",
      "An overlap exists only when the first value is smaller than the second.",
    ],
    noteMarkdown: `## Overlap invariant

Two half-open intervals overlap when:

> max(start₁, start₂) < min(end₁, end₂)

### Why it works

The later start is the first moment when both intervals could be active. The earlier end is the last possible boundary. There is shared time only when the possible start comes before that boundary.

- Touching endpoints are not an overlap for half-open intervals.
- Decide the interval convention before coding.
- This invariant is the prerequisite for sweep-line and meeting-room problems.`,
    goalRelevance: { "amazon-sde2": 0.82, "google-l4": 0.72 },
    dependencyValue: 0.94,
    uncertainty: 0.28,
  },
  {
    id: "meeting-rooms",
    skillId: "intervals",
    tags: ["intervals", "heap", "interview"],
    prerequisiteCardId: "interval-overlap",
    mode: "solve",
    title: "Meeting Rooms II",
    prompt: "Rebuild the solution from memory. Begin with the heap invariant, then write the algorithm.",
    hintKeywords: ["sort by start", "earliest end", "reuse room"],
    scaffold: [
      "Process meetings in start-time order.",
      "Keep the earliest room-release time accessible.",
      "The number of active release times is the number of rooms in use.",
    ],
    noteMarkdown: `## Core model

A room becomes reusable when its current meeting ends before the next meeting starts.

### Min-heap invariant

The heap contains the end time of every room currently in use. Its smallest value is the room that becomes available first.

### Algorithm

- Sort meetings by start time.
- If the earliest ending meeting has finished, reuse that room.
- Push the current meeting end time.
- The maximum heap size is the minimum number of rooms.

### Complexity

Sorting dominates at **O(n log n)**. Every interval enters and leaves the heap at most once.`,
    goalRelevance: { "amazon-sde2": 0.97, "google-l4": 0.78 },
    dependencyValue: 0.82,
    uncertainty: 0.31,
  },
  {
    id: "notification-ood",
    skillId: "ood",
    tags: ["ood", "system-design"],
    mode: "design",
    title: "Design a Notification System",
    prompt: "Support email, SMS, and push. Add a new channel without editing existing channel classes. Explain your object boundaries.",
    hintKeywords: ["channel contract", "strategy", "dispatcher"],
    scaffold: [
      "Separate message content from delivery behavior.",
      "Give every delivery channel the same contract.",
      "Let a dispatcher depend on the contract rather than concrete channels.",
    ],
    noteMarkdown: "",
    goalRelevance: { "amazon-sde2": 0.95, "google-l4": 0.54 },
    dependencyValue: 0.88,
    uncertainty: 0.76,
  },
  {
    id: "interface-english",
    skillId: "expression",
    tags: ["technical-english", "java", "interview"],
    mode: "speak",
    title: "Explain an Interface",
    prompt: "Give a clear spoken answer: what is a Java interface, when would you use one, and what problem does it solve?",
    hintKeywords: ["contract", "decoupling", "multiple implementations"],
    scaffold: [
      "Define the abstraction in one sentence.",
      "Explain how callers depend on behavior rather than a concrete class.",
      "Give one example with interchangeable implementations.",
    ],
    noteMarkdown: `## Interview answer

An interface defines a behavioral contract without committing callers to one implementation.

I use it when multiple classes should be interchangeable, or when I want high-level code to depend on an abstraction. For example, a NotificationService can depend on a NotificationChannel interface while EmailChannel and SmsChannel provide different implementations.

### Keep the answer concrete

- Start with the contract.
- Name the coupling problem it removes.
- End with one real implementation example.`,
    goalRelevance: { "amazon-sde2": 0.83, "google-l4": 0.81 },
    dependencyValue: 0.61,
    uncertainty: 0.69,
  },
  {
    id: "jwt-recall",
    skillId: "spring",
    tags: ["spring", "security", "jwt"],
    mode: "recall",
    title: "JWT Request Lifecycle",
    prompt: "Trace one authenticated Spring request from the Authorization header to the controller. Do not open your notes.",
    hintKeywords: ["security filter", "token validation", "SecurityContext"],
    scaffold: [
      "A filter reads the bearer token before the controller runs.",
      "Validation produces an authenticated principal.",
      "The authentication is stored for downstream authorization.",
    ],
    noteMarkdown: `## Request path

- A security filter reads the **Authorization** header.
- The token service verifies signature, expiry, and claims.
- User details or authorities are resolved.
- An Authentication object is created.
- SecurityContext receives the authentication.
- Authorization rules run before the controller method.

### Common failure

Parsing a token is not authentication. The request becomes authenticated only after validated identity and authorities are placed into the SecurityContext.`,
    goalRelevance: { "amazon-sde2": 0.64, "google-l4": 0.49 },
    dependencyValue: 0.63,
    uncertainty: 0.45,
  },
  {
    id: "graph-traversal",
    skillId: "graph",
    tags: ["graphs", "dfs", "interview"],
    mode: "solve",
    title: "Clone Graph",
    prompt: "Solve the problem and state the invariant that prevents cycles and duplicated cloned nodes.",
    hintKeywords: ["old-to-new map", "visit once", "wire neighbors"],
    scaffold: [
      "Create a clone when an original node is first encountered.",
      "Store the original-to-clone relationship before traversing neighbors.",
      "Reuse the stored clone whenever the original node appears again.",
    ],
    noteMarkdown: `## Core invariant

The visited map is not only a cycle guard. It is the identity map from each original node to exactly one cloned node.

### DFS shape

- Return the stored clone if the node is already mapped.
- Create and store the clone before recursing.
- Clone every neighbor and append it to the cloned adjacency list.

### Complexity

Every node and edge is visited once: **O(V + E)** time and **O(V)** auxiliary space, excluding the output graph.`,
    goalRelevance: { "amazon-sde2": 0.66, "google-l4": 0.99 },
    dependencyValue: 0.8,
    uncertainty: 0.43,
  },
];

export function createInitialCardMemory(cards: NoteCard[]): Record<string, CardMemory> {
  return Object.fromEntries(
    cards.map((card) => [
      card.id,
      { intervalScale: 1, skipCount: 0, needsSplit: false, prerequisiteNeeded: false },
    ]),
  );
}

export function rankCards(
  cards: NoteCard[],
  profile: GoalProfile,
  skills: SkillState[],
  memory: Record<string, CardMemory>,
): RankedCard[] {
  const focusedCards =
    profile.focusSkillIds.length > 0
      ? cards.filter((card) => profile.focusSkillIds.includes(card.skillId))
      : cards;

  const daysUntilDeadline = profile.sprintDeadline
    ? Math.ceil((new Date(profile.sprintDeadline).getTime() - Date.now()) / 86_400_000)
    : 30;
  const paceBias = clamp((profile.paceBias ?? 25) / 100);
  const deadlineUrgency = profile.sprintDeadline
    ? Math.min(1, Math.max(0, 1 - Math.max(0, daysUntilDeadline) / 30))
    : paceBias;
  const sprintUrgency = paceBias * (0.55 + deadlineUrgency * 0.45);

  return focusedCards
    .map((card) => {
      const skill = skills.find((item) => item.id === card.skillId);
      const skillRetention = skill?.retention ?? 0.5;
      const masteryGap = 1 - (skill?.mastery ?? 0.5);
      const goalRelevance = card.goalRelevance[profile.baseGoal];
      const cardMemory = memory[card.id] ?? {
        intervalScale: 1,
        skipCount: 0,
        needsSplit: false,
        prerequisiteNeeded: false,
      };

      const retentionNeed = 1 - skillRetention;
      const prerequisiteBonus = cardMemory.prerequisiteNeeded ? 0.18 : 0;
      const sprintBonus = sprintUrgency * (goalRelevance * 0.65 + masteryGap * 0.35) * 0.1;
      const familiarityDiscount = Math.sqrt(Math.max(1, cardMemory.intervalScale));
      const retentionWeight = 0.44 - paceBias * 0.1;
      const goalWeight = 0.22 + paceBias * 0.1;
      const masteryWeight = 0.17 - paceBias * 0.02;
      const hiddenPriority =
        (retentionNeed * retentionWeight +
          goalRelevance * goalWeight +
          masteryGap * masteryWeight +
          card.dependencyValue * 0.1 +
          card.uncertainty * 0.08 +
          sprintBonus +
          prerequisiteBonus) /
        familiarityDiscount;

      return { ...card, hiddenPriority };
    })
    .sort((a, b) => b.hiddenPriority - a.hiddenPriority);
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function applyMemoryFeedback(
  skills: SkillState[],
  card: NoteCard,
  feedback: MemoryFeedback,
  hintDepth: 0 | 1 | 2,
): { skills: SkillState[]; delta: MemoryDelta } {
  const currentSkill = skills.find((skill) => skill.id === card.skillId) ?? skills[0];
  const metric: MemoryDelta["metric"] = card.mode === "speak" ? "expression" : "retention";
  const before = currentSkill[metric];

  const baseGain =
    feedback === "overlearned" ? 0.075 :
    feedback === "guided" ? 0.032 :
    0.006;
  const hintAdjustment = feedback === "overlearned" ? 1 : Math.max(0.45, 1 - hintDepth * 0.22);
  const gain = baseGain * hintAdjustment;

  const updatedSkills = skills.map((skill) => {
    if (skill.id !== card.skillId) return skill;

    return {
      ...skill,
      [metric]: clamp(skill[metric] + gain),
      mastery: clamp(skill.mastery + (feedback === "prerequisite" ? 0 : gain * 0.28)),
      confidence: clamp(skill.confidence + (feedback === "prerequisite" ? 0.008 : 0.025)),
    };
  });

  const after = updatedSkills.find((skill) => skill.id === card.skillId)?.[metric] ?? before;

  const message =
    feedback === "overlearned"
      ? "Interval expanded. This card will appear less often."
      : feedback === "prerequisite"
        ? "A prerequisite will be retrieved before this card returns."
        : "The card returned to normal memory scheduling.";

  return {
    skills: updatedSkills,
    delta: { skillName: currentSkill.name, metric, before, after, message },
  };
}

export function updateCardMemory(
  memory: Record<string, CardMemory>,
  cardId: string,
  feedback: MemoryFeedback,
): Record<string, CardMemory> {
  const current = memory[cardId] ?? {
    intervalScale: 1,
    skipCount: 0,
    needsSplit: false,
    prerequisiteNeeded: false,
  };

  return {
    ...memory,
    [cardId]: {
      ...current,
      intervalScale: feedback === "overlearned" ? current.intervalScale * 1.8 : current.intervalScale,
      prerequisiteNeeded: feedback === "prerequisite",
    },
  };
}

export function recordSilentSkip(
  memory: Record<string, CardMemory>,
  cardId: string,
): Record<string, CardMemory> {
  const current = memory[cardId] ?? {
    intervalScale: 1,
    skipCount: 0,
    needsSplit: false,
    prerequisiteNeeded: false,
  };
  const skipCount = current.skipCount + 1;

  return {
    ...memory,
    [cardId]: {
      ...current,
      skipCount,
      needsSplit: current.needsSplit || skipCount >= 3,
    },
  };
}
