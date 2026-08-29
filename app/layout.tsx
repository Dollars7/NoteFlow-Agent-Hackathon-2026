import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { LocaleProvider } from "./locale";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: "NoteFlow — Don’t plan. Just flow.",
    description:
      "An AI learning conductor that chooses the next best action for your goal.",
    icons: {
      icon: [{ url: "/noteflow-icon.png", type: "image/png" }],
      shortcut: "/noteflow-icon.png",
    },
    openGraph: {
      title: "NoteFlow — Don’t plan. Just flow.",
      description: "The AI that decides what you should learn next.",
      type: "website",
      images: [{ url: "/og.png", width: 1792, height: 922, alt: "NoteFlow learning conductor" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "NoteFlow — Don’t plan. Just flow.",
      description: "The AI that decides what you should learn next.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><LocaleProvider>{children}</LocaleProvider></body>
    </html>
  );
}
