"use client";

import { useEffect } from "react";
import type { ToastMessage } from "../notifications";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

const ICONS = {
  success: CheckIcon,
  error: AlertIcon,
  info: InfoIcon,
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  const Icon = ICONS[toast.tone];

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 5000);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={`toast ${toast.tone}`} role="status">
      <span className="toast-icon">
        <Icon size={16} />
      </span>
      <p>{toast.message}</p>
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Đóng thông báo">
        ×
      </button>
    </div>
  );
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
