"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  hackathonHandoffKey,
  isHackathonHandoff,
  type HackathonHandoff,
} from "../../lib/hackathon-handoff";
import { useLocale } from "../locale";
import NoteFlowApp from "../noteflow-app";

let cachedHandoffSource: string | null | undefined;
let cachedHandoff: HackathonHandoff | null = null;

function readAgentHandoff(): HackathonHandoff | null {
  if (new URLSearchParams(window.location.search).get("source") !== "agent") return null;
  const source = window.localStorage.getItem(hackathonHandoffKey);
  if (source === cachedHandoffSource) return cachedHandoff;
  cachedHandoffSource = source;
  if (!source) return (cachedHandoff = null);
  try {
    const parsed = JSON.parse(source) as unknown;
    return (cachedHandoff = isHackathonHandoff(parsed) ? parsed : null);
  } catch {
    return (cachedHandoff = null);
  }
}

function subscribeToAgentHandoff(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function GuestWorkspace() {
  const { t } = useLocale();
  const agentHandoff = useSyncExternalStore(subscribeToAgentHandoff, readAgentHandoff, () => null);
  const getAccessToken = useCallback(async () => null, []);
  const onSignOut = useCallback(async () => undefined, []);
  const guestUser = {
    id: "hackathon-guest",
    displayName: t("Guest learner", "访客学习者"),
    email: "",
    authProvider: "guest",
  };

  return (
    <NoteFlowApp
      key={agentHandoff?.id ?? "default"}
      user={guestUser}
      getAccessToken={getAccessToken}
      onSignOut={onSignOut}
      isGuest
      agentHandoff={agentHandoff}
    />
  );
}
