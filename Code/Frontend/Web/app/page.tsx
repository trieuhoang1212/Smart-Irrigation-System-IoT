import { Suspense } from "react";
import App from "../src/App";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="app-shell">
          <section className="content status-page">
            <div className="status-card">
              <strong>Đang tải...</strong>
              <p>Đang lấy dữ liệu khu vườn từ máy chủ.</p>
            </div>
          </section>
        </main>
      }
    >
      <App />
    </Suspense>
  );
}
