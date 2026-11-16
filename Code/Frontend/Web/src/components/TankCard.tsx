"use client";

import { DropletIcon } from "./icons";
import { Tooltip } from "./Tooltip";

interface TankCardProps {
  tankDistanceCm: number | null;
  tankEmpty: boolean;
}

export function TankCard({ tankDistanceCm, tankEmpty }: TankCardProps) {
  // Tính % dung tích nước còn lại trong bồn (giả định chiều cao bồn 100cm, khoảng cách càng lớn nước càng cạn)
  const waterPercent =
    tankDistanceCm === null
      ? null
      : Math.max(0, Math.min(100, Math.round(100 - tankDistanceCm)));

  return (
    <article className="panel tank-card">
      <div className="panel-heading">
        <div>
          <h2>
            Mực nước bồn chứa
            <Tooltip text="Mực nước dự trữ trong bồn. Dưới 20% (cách miệng bồn ≥ 80cm) hệ thống sẽ khóa bơm để chống chạy khô." />
          </h2>
          <p>Dung tích nước sẵn sàng để tưới cây</p>
        </div>
        <span className="card-icon">
          <DropletIcon size={18} />
        </span>
      </div>

      <div className="tank-headline">
        <div className="tank-reading">
          <strong>{waterPercent === null ? "--" : waterPercent}</strong>
          <small>%</small>
          {tankDistanceCm !== null && (
            <span className="tank-cm-hint">({Math.round(tankDistanceCm)} cm tới mặt nước)</span>
          )}
        </div>
        <span
          className={`live-badge ${
            tankEmpty
              ? "danger"
              : waterPercent === null
                ? ""
                : waterPercent <= 25
                  ? "danger"
                  : "active"
          }`}
        >
          <i />
          {tankEmpty
            ? "Bồn cạn nước"
            : waterPercent === null
              ? "Chưa có dữ liệu"
              : waterPercent <= 25
                ? "Sắp hết nước"
                : "Đủ nước tưới"}
        </span>
      </div>

      <div className="tank-gauge">
        <div className="tank-track">
          {waterPercent !== null && (
            <span
              className={`tank-marker ${tankEmpty || waterPercent <= 25 ? "danger" : ""}`}
              style={{ left: `${waterPercent}%` }}
            />
          )}
        </div>
        <div className="tank-scale">
          <span>0% · cạn</span>
          <span>100% · đầy</span>
        </div>
      </div>

      <p className="tank-caption">
        {tankEmpty
          ? "Bồn nước đã cạn: hệ thống tự động khóa bơm để chống cháy thiết bị."
          : waterPercent === null
            ? "Chưa nhận được số đo từ cảm biến."
            : waterPercent <= 25
              ? "Mực nước xuống thấp: nên sớm châm thêm nước vào bồn."
              : "Mực nước dồi dào, sẵn sàng phục vụ các lượt tưới tự động."}
      </p>

      <div className="health-footer">
        <span>Báo cạn: <strong>dưới 20%</strong></span>
        <span>Hồi nước: <strong>trên 40%</strong></span>
      </div>
    </article>
  );
}
