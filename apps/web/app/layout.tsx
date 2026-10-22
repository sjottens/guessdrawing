import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Krabbel — teken en raad",
  description: "Realtime multiplayer tekenspel: teken een woord, laat je vrienden raden.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="font-sans text-slate-800 antialiased">{children}</body>
    </html>
  );
}
