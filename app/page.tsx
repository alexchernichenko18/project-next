"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getToken } from "@/lib/tokens";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    router.replace(token ? "/messages" : "/sign-in");
  }, [router]);

  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
    >
      Redirecting…
    </div>
  );
}
