"use client";

import { Btn } from "@/components/ui/FnUi";
import { signOut } from "next-auth/react";

export function SignOutButton({ dark }: { dark?: boolean }) {
  if (dark) {
    return (
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-full rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        Esci
      </button>
    );
  }
  return (
    <Btn variant="ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
      Esci
    </Btn>
  );
}
