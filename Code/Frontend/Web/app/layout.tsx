import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "../src/App.css";

const lexend = Lexend({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-lexend",
});

export const metadata: Metadata = {
  title: "Greenflow | Smart Irrigation",
  description: "Dashboard giám sát và điều khiển hệ thống tưới thông minh.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={lexend.variable}>{children}</body>
    </html>
  );
}
