"use client";

import { useEffect, useState } from "react";

export function Countdown({ until, readyText = "已就绪" }: { until: number; readyText?: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, until - Date.now()));

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, until - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [until]);

  if (remaining <= 0) return <span className="ready">{readyText}</span>;
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return <span className="cooling">{minutes}:{String(seconds).padStart(2, "0")}</span>;
}
