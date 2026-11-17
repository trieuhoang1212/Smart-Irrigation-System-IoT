"use client";

import { useEffect } from "react";

/**
 * Đánh dấu đây là lần chuyển trang trong app (không phải tải lại).
 * Nhờ vậy lần đầu vẫn có cảnh nhập trang đầy đủ, còn các lần chuyển tab
 * chỉ chạy một nhịp mờ nhẹ, không dựng lại sidebar và biểu đồ.
 */
export function RouteMotion() {
  useEffect(() => {
    const mark = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      const link = target instanceof Element ? target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      document.documentElement.classList.add("is-returning");
    };

    document.addEventListener("click", mark, true);
    return () => document.removeEventListener("click", mark, true);
  }, []);

  return null;
}
