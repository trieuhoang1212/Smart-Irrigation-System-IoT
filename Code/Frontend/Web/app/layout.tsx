import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import "../src/App.css";
import { RouteMotion } from "../src/components/RouteMotion";

const lexend = Lexend({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-lexend",
});

export const metadata: Metadata = {
  title: "Greenflow | Smart Irrigation",
  description: "Dashboard giám sát và điều khiển hệ thống tưới thông minh.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={lexend.variable}>
        <RouteMotion />
        {children}
      </body>
    </html>
  );
}
