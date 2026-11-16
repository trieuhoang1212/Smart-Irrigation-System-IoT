import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalysisApp } from "../../src/AnalysisApp";

export const metadata: Metadata = {
  title: "Phân tích cây trồng | Greenflow",
  description:
    "Đánh giá sức khỏe cây trồng từ độ ẩm đất, thời tiết và nguồn nước.",
};

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <main className="app-shell">
          <section className="content status-page">
            <div className="status-card">
              <strong>Đang tải...</strong>
              <p>Đang lấy dữ liệu phân tích từ máy chủ.</p>
            </div>
          </section>
        </main>
      }
    >
      <AnalysisApp />
    </Suspense>
  );
}
