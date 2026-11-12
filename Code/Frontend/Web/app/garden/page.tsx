import type { Metadata } from "next";
import { GardenManager } from "../../src/components/GardenManager";

export const metadata: Metadata = {
  title: "Quản lý khu vườn | Greenflow",
  description: "Đổi loại cây, ảnh nhận diện và thông tin canh tác cho từng ô trồng.",
};

export default function GardenPage() {
  return <GardenManager />;
}
