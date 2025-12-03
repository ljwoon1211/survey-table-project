import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Survey Table - 쉽고 빠른 설문조사 플랫폼",
  description:
    "Apple처럼 간단하고 직관적인 설문조사 도구. 복잡한 기능은 숨기고 필요한 것만. 구글 폼보다 아름답고 사용하기 쉬운 설문 플랫폼입니다.",
  keywords: ["설문조사", "설문", "폼", "survey", "form", "설문도구"],
  authors: [{ name: "Survey Table Team" }],
  robots: "index, follow",
  openGraph: {
    title: "Survey Table - 쉽고 빠른 설문조사 플랫폼",
    description: "Apple처럼 간단하고 직관적인 설문조사 도구",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Survey Table - 쉽고 빠른 설문조사 플랫폼",
    description: "Apple처럼 간단하고 직관적인 설문조사 도구",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
      </head>
      <body className={`${geistMono.variable} antialiased`} suppressHydrationWarning={true}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
