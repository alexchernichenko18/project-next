"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/hooks/useAuth";
import { getToken } from "@/lib/tokens";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const me = useMe();
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  // Client-only token presence check, deferred to an effect to avoid an
  // SSR/CSR mismatch on the initial render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasToken(Boolean(getToken()));
  }, []);

  // Only bounce to /messages once useMe has actually verified the token.
  // Reacting to mere getToken() presence (the previous behaviour) caused a
  // loop with ProtectedLayout whenever /auth/me failed for non-401 reasons
  // (e.g. CORS/network), because the token stayed in localStorage.
  useEffect(() => {
    if (me.isSuccess) {
      router.replace("/messages");
    }
  }, [me.isSuccess, router]);

  // Show a brief loader only while we genuinely don't know yet: we haven't
  // measured the token, or we have one and useMe is still in flight.
  const verifying = hasToken === null || (hasToken && me.isPending);

  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
