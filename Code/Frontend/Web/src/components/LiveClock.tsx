"use client";

import { useEffect, useState } from "react";
import { ClockIcon } from "./icons";

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const kickoff = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  if (!now) {
    return (
      <span className="topbar-clock" aria-label="Ngày giờ hiện tại">
        <ClockIcon size={13} />
        <span>Đang lấy giờ...</span>
      </span>
    );
  }

  const date = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const shortDate = now.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
  const time = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <time
      className="topbar-clock"
      dateTime={now.toISOString()}
      title="Ngày giờ hiện tại"
      aria-label={`${date}, ${time}`}
    >
      <ClockIcon size={13} />
      <span className="topbar-clock-date">{date}</span>
      <span className="topbar-clock-short">{shortDate}</span>
      <strong>{time}</strong>
    </time>
  );
}
