"use client";

import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;

export function SessionKeeper() {
  useEffect(() => {
    const refresh = () => {
      void fetch("/api/auth/refresh", {
        credentials: "same-origin",
        method: "POST",
      }).catch(() => undefined);
    };

    refresh();
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return null;
}
