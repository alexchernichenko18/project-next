"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useGoogleSignIn } from "@/hooks/useAuth";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SRC = "https://accounts.google.com/gsi/client";
// GIS renderButton caps width at 400px.
const MAX_BUTTON_WIDTH = 400;

type Props = {
  intent: "sign-in" | "sign-up";
};

export function GoogleSignInButton({ intent }: Props) {
  const router = useRouter();
  const googleSignIn = useGoogleSignIn();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(
    typeof window !== "undefined" && !!window.google,
  );
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!scriptReady) return;
    if (!GOOGLE_CLIENT_ID) return;
    const container = containerRef.current;
    if (!container || !window.google) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      ux_mode: "popup",
      callback: (response) => {
        if (!response.credential) {
          toast.error("Google sign-in was cancelled. Try again.");
          return;
        }
        googleSignIn.mutate(
          { idToken: response.credential },
          {
            onSuccess: () => {
              router.replace("/messages");
            },
            onError: (error) => {
              if (error.status === 401) {
                toast.error(
                  "Couldn't sign in with Google. Try again or use email.",
                );
                return;
              }
              toast.error(error.message || "Network error. Please retry.");
            },
          },
        );
      },
    });

    const measured = container.clientWidth || 320;
    const width = Math.min(measured, MAX_BUTTON_WIDTH);

    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "rectangular",
      text: intent === "sign-up" ? "signup_with" : "signin_with",
      logo_alignment: "left",
      width,
    });
  }, [scriptReady, intent, googleSignIn, router]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-center text-xs text-muted-foreground">
        Set <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in
        .env.local to enable Google sign-in.
      </div>
    );
  }

  return (
    <>
      <Script
        src={GIS_SRC}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
      />
      <div className="flex w-full justify-center">
        <div ref={containerRef} className="w-full" />
      </div>
    </>
  );
}
