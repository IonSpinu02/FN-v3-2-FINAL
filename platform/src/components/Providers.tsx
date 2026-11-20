"use client";

import { RealtimeSyncProvider } from "@/components/realtime/RealtimeSyncProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <RealtimeSyncProvider>{children}</RealtimeSyncProvider>
    </ThemeProvider>
  );
}
