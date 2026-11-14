import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryApp } from "../../src/HistoryApp";

export const metadata: Metadata = {
  title: "Lịch sử cảm biến | Greenflow",
  description: "Theo dõi độ ẩm đất, nhiệt độ, độ ẩm không khí và cảm biến mưa theo thời gian.",
};

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <main className="app-shell">
          <section className="content status-page">
            <div className="status-card">
              <strong>Đang tải...</strong>
              <p>Đang lấy dữ liệu cảm biến từ Backend.</p>
            </div>
          </section>
        </main>
      }
    >
      <HistoryApp />
    </Suspense>
  );
}
