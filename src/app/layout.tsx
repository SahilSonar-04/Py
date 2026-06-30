import type { Metadata } from "next";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Py | Workflow Builder",
  description: "A focused clone of the Galaxy.ai LLM workflow builder.",
};

const LINKEDIN_URL =
  process.env.NEXT_PUBLIC_CANDIDATE_LINKEDIN ?? "https://www.linkedin.com/in/PLACEHOLDER";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full flex flex-col hide-scrollbar">
          <Script id="candidate-log" strategy="afterInteractive">
            {`console.log("[Py] Candidate LinkedIn:\\n${LINKEDIN_URL}");`}
          </Script>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}