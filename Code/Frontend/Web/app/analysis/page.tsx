import type { Metadata } from "next";
import { AnalysisApp } from "../../src/AnalysisApp";

export const metadata: Metadata = {
  title: "Phân tích cây trồng | Greenflow",
  description:
    "Đánh giá sức khỏe cây trồng từ độ ẩm đất, thời tiết và nguồn nước.",
};

export default function AnalysisPage() {
  return <AnalysisApp />;
}
