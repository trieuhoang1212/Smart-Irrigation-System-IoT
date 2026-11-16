"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

const EDGE = 8;

export function Tooltip({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    if (!open) {
      box.style.marginLeft = "";
      box.style.removeProperty("--tip-arrow");
      return;
    }

    const place = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;

      const width = box.offsetWidth;
      const wrapRect = wrap.getBoundingClientRect();
      const left = wrapRect.left + wrapRect.width / 2 - width / 2;

      // Đẩy hộp vào trong khi gần mép màn hình để chữ không bị cắt.
      let offset = 0;
      if (left + width > window.innerWidth - EDGE) {
        offset = window.innerWidth - EDGE - (left + width);
      }
      if (left + offset < EDGE) offset = EDGE - left;

      // Mũi tên vẫn chỉ vào icon dù hộp đã dịch.
      const tip = Math.min(Math.max(width / 2 - offset, 12), width - 12);
      box.style.marginLeft = `${offset}px`;
      box.style.setProperty("--tip-arrow", `${tip}px`);
    };

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={`tooltip-wrap${open ? " open" : ""}`}
      tabIndex={0}
      aria-label={text}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children ?? <span className="tooltip-icon">i</span>}
      <span className="tooltip-box" role="tooltip" ref={boxRef}>
        {text}
      </span>
    </span>
  );
}
