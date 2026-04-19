import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "흑음 매거진 메이커",
  description: "한국 블랙 뮤직 인스타그램 매거진 제작 자동화 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
