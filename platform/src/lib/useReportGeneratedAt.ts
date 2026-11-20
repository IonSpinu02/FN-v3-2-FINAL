"use client";

import { useEffect, useState } from "react";

/** Identical initial HTML on server and client; refresh the date before printing. */
export function useReportGeneratedAt(): string {
  const [generated, setGenerated] = useState("");
  useEffect(() => {
    const update = () => setGenerated(new Date().toLocaleString("it-IT"));
    const timer = window.setTimeout(update, 0);
    window.addEventListener("beforeprint", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeprint", update);
    };
  }, []);
  return generated;
}
