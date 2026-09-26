import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter-tight";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import { themeBootScript } from "@/components/ThemeSwitch";

export const metadata: Metadata = {
  title: "Scenes — story shorts with consistent characters",
  description:
    "Write a short story. Scenes storyboards it, draws the same characters in every shot, narrates it, and hands you a 30–60 second short ready to edit.",
};

export const viewport: Viewport = {
  themeColor: "#F7F3EC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
