import type { Metadata } from "next";
import { headers } from "next/headers";
import { HackathonDemo } from "./hackathon-demo";
import styles from "./hackathon.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = "NoteFlow Agent — All Things Agentic";
  const description =
    "A learning partner that turns messy notes and retrieval feedback into an adaptive knowledge path.";

  return {
    metadataBase,
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{url: "/hackathon-og.png", width: 1536, height: 1024, alt: "NoteFlow Agent knowledge path"}],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/hackathon-og.png"],
    },
  };
}

export default function HackathonPage() {
  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.header}>
        <a className={styles.brand} href="/hackathon" aria-label="NoteFlow Agent home">
          <span className={styles.brandMark}>N</span>
          <span>NoteFlow Agent</span>
        </a>
        <div className={styles.category}>Collaborative Partner · 2026 entry</div>
      </header>

      <HackathonDemo />
    </main>
  );
}
