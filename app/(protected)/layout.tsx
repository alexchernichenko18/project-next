"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe, useSignOut } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/tokens";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const signOut = useSignOut();
  const meQuery = useMe();

  useEffect(() => {
    if (!getToken()) {
      router.replace("/sign-in");
    }
  }, [router]);

  // No redirect on meQuery.isError here: a real 401 is already handled by
  // apiFetch -> reportSessionExpired -> Providers (clears token + navigates
  // to /sign-in). Redirecting on every error caused a loop with AuthLayout
  // when the backend was unreachable (CORS/network) but the token stayed
  // in localStorage.

  if (meQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (meQuery.isError) {
    const isAuth = meQuery.error?.status === 401;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center text-sm">
        <p className="text-muted-foreground">
          {isAuth
            ? "Signing you out…"
            : meQuery.error?.message || "Can't reach the server right now."}
        </p>
        {!isAuth && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => meQuery.refetch()}
            >
              Retry
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                signOut();
                router.replace("/sign-in");
              }}
            >
              Sign out
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!meQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-5 py-3">
        <div className="text-base font-semibold tracking-tight">Chat</div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{meQuery.data.email}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              signOut();
              router.replace("/sign-in");
            }}
          >
            Logout
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
