import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityApp } from "../../src/ActivityApp";

export const metadata: Metadata = {
  title: "Nhật ký hoạt động | Greenflow",
  description: "Lệnh điều khiển, chế độ và thay đổi ngưỡng được Backend ghi lại theo thời gian.",
};

export default function ActivityPage() {
  return (
    <Suspense
      fallback={
        <main className="app-shell">
          <section className="content status-page">
            <div className="status-card">
              <strong>Đang tải...</strong>
              <p>Đang lấy nhật ký hoạt động từ Backend.</p>
            </div>
          </section>
        </main>
      }
    >
      <ActivityApp />
    </Suspense>
  );
}
