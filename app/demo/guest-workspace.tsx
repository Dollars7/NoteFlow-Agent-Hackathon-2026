"use client";

import { useCallback } from "react";
import { useLocale } from "../locale";
import NoteFlowApp from "../noteflow-app";

export function GuestWorkspace() {
  const { t } = useLocale();
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
      user={guestUser}
      getAccessToken={getAccessToken}
      onSignOut={onSignOut}
      isGuest
    />
  );
}
