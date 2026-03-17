import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shroud Protocol — Private Savings Circles",
  description:
    "Privacy-preserving ROSCA using ZK membership proofs and FROST threshold signatures on Arbitrum.",
  openGraph: {
    title: "Shroud Protocol",
    description: "Anonymous membership. Threshold custody. Shape Rotator 2026.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="font-display antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
