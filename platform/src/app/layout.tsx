import { Providers } from "@/components/Providers";
import type { Metadata } from "next";
import { DM_Sans, Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const ibmMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Futuro Nazionale — Scenario territoriale",
  description:
    "Piattaforma interna di scenario territoriale v3.2 (non previsione validata).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${dmSans.variable} ${fraunces.variable} ${ibmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-fn-text">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
