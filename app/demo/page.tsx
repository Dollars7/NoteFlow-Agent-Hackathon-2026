import type { Metadata } from "next";
import { GuestWorkspace } from "./guest-workspace";

export const metadata: Metadata = {
  title: "NoteFlow Guest Learning Workspace",
  description: "Try NoteFlow's retrieval-first learning flow without creating an account.",
};

export default function DemoPage() {
  return <GuestWorkspace />;
}
