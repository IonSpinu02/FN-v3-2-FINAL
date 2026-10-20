"use client";

import { Panel } from "@/components/ui/FnUi";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/app/scenario";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError("Credenziali non valide o email non in allowlist.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <Panel className="w-full max-w-md p-8">
      <div className="mb-6 lg:hidden">
        <div className="mb-4 flex gap-1">
          <span className="h-1 w-8 rounded-full bg-[var(--fn-italy-green)]" />
          <span className="h-1 w-8 rounded-full bg-fn-border" />
          <span className="h-1 w-8 rounded-full bg-[var(--fn-italy-red)]" />
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-fn-text fn-heading-shine">
          Futuro Nazionale
        </h1>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Accedi
          </h2>
          <p className="mt-1 text-sm text-fn-text-muted">
            Email autorizzata e password piattaforma
          </p>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="fn-label">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="fn-input"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="fn-label">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="fn-input"
          />
        </label>
        {error && (
          <p className="text-sm text-fn-danger" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="fn-btn fn-btn-primary w-full py-2.5"
        >
          {pending ? "Accesso in corso…" : "Entra nella dashboard"}
        </button>
      </form>
    </Panel>
  );
}
