"use client";

import { useCallback, useEffect, useState } from "react";
import {
  hackathonHandoffKey,
  isHackathonHandoff,
  type HackathonHandoff,
} from "../../lib/hackathon-handoff";
import { useLocale } from "../locale";
import NoteFlowApp from "../noteflow-app";

export function GuestWorkspace() {
  const { t } = useLocale();
  const [agentHandoff, setAgentHandoff] = useState<HackathonHandoff | null>(null);
  const getAccessToken = useCallback(async () => null, []);
  const onSignOut = useCallback(async () => undefined, []);
  const guestUser = {
    id: "hackathon-guest",
    displayName: t("Guest learner", "访客学习者"),
    email: "",
    authProvider: "guest",
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("source") !== "agent") return;
    const raw = window.localStorage.getItem(hackathonHandoffKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isHackathonHandoff(parsed)) setAgentHandoff(parsed);
    } catch {
      // Remove an invalid handoff and open the normal guest workspace.
      window.localStorage.removeItem(hackathonHandoffKey);
    }
  }, []);

  return (
    <NoteFlowApp
      user={guestUser}
      getAccessToken={getAccessToken}
      onSignOut={onSignOut}
      isGuest
      agentHandoff={agentHandoff}
    />
  );
}
