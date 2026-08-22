"use client";

import { useCallback } from "react";
import NoteFlowApp from "../noteflow-app";

const guestUser = {
  id: "hackathon-guest",
  displayName: "访客学习者",
  email: "",
  authProvider: "guest",
};

export function GuestWorkspace() {
  const getAccessToken = useCallback(async () => null, []);
  const onSignOut = useCallback(async () => undefined, []);

  return (
    <NoteFlowApp
      user={guestUser}
      getAccessToken={getAccessToken}
      onSignOut={onSignOut}
      isGuest
    />
  );
}
