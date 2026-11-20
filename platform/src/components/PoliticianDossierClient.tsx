"use client";

import { PoliticianDossierPanel } from "@/components/PoliticianDossierPanel";
import type { TrackedPolitician } from "@/lib/politicalDefectionsEngine";
import { useState } from "react";

export function PoliticianDossierClient({
  politician,
}: {
  politician: TrackedPolitician;
}) {
  const [simulated, setSimulated] = useState(false);

  return (
    <main className="min-h-dvh bg-[#06080F] px-4 py-6 text-slate-100 lg:px-8">
      <PoliticianDossierPanel
        politician={politician}
        simulated={simulated}
        onSimula={() => setSimulated((v) => !v)}
      />
    </main>
  );
}
