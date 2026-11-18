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
      <head>
        {/* Áp trạng thái ẩn/hiện thanh bên trước khi vẽ để không bị nhảy layout. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var r=document.documentElement;["nav","rail"].forEach(function(p){var v=localStorage.getItem("greenflow:panel:"+p);if(v==="collapsed"||v==="open")r.dataset[p]=v;});}catch(e){}',
          }}
        />
      </head>
      <body className={lexend.variable}>
        <RouteMotion />
        {children}
      </body>
    </html>
  );
}
