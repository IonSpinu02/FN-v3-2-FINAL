import { auth } from "@/auth";
import { LoginForm } from "@/components/LoginForm";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const instant = false;

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="screen-only flex min-h-full flex-1">
      <section className="hidden w-1/2 flex-col justify-between bg-fn-sidebar p-12 text-fn-sidebar-muted lg:flex">
        <div>
          <div className="mb-8 flex gap-1">
            <span className="h-1 w-12 rounded-full bg-[var(--fn-italy-green)]" />
            <span className="h-1 w-12 rounded-full bg-white/90" />
            <span className="h-1 w-12 rounded-full bg-[var(--fn-italy-red)]" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Uso interno · Dirigenza
          </p>
          <h1
            className="mt-4 font-[family-name:var(--font-fraunces)] text-4xl font-semibold leading-tight text-white"
          >
            Scenario territoriale
            <br />
            <span className="text-white/85">Futuro Nazionale</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-fn-sidebar-muted">
            Mappa ipotetica delle 20 regioni, sensibilità ai pesi, simulazione
            demoscopica interna e validazione ex post. Non è una previsione
            elettorale certificata.
          </p>
        </div>
        <p className="text-xs text-white/40">Modello v3.2 · predizione_validata: false</p>
      </section>
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <Suspense
          fallback={
            <p className="text-fn-text-muted">Caricamento accesso…</p>
          }
        >
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
