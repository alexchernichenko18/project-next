"use client";

// Test harness for verifying the Sentry integration end-to-end. Delete this
// route once dashboard issues, replays, and distributed traces are confirmed.

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function SentryExamplePage() {
  const [status, setStatus] = useState<string | null>(null);

  const throwClientError = () => {
    throw new Error("Sentry test: manual client-side error");
  };

  const captureHandledError = () => {
    try {
      throw new Error("Sentry test: handled exception via captureException");
    } catch (err) {
      Sentry.captureException(err);
      setStatus("Captured handled exception — check Sentry Issues.");
    }
  };

  const tracedBackendCall = async () => {
    setStatus("Calling backend to verify distributed tracing…");
    await Sentry.startSpan(
      { name: "sentry-example-page: backend ping", op: "http.client" },
      async () => {
        try {
          const res = await fetch(`${API_URL}/auth/me`, {
            headers: { Accept: "application/json" },
          });
          setStatus(
            `Backend responded ${res.status}. Check Performance for a stitched trace.`,
          );
        } catch (err) {
          Sentry.captureException(err);
          setStatus(
            `Backend call failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-lg font-semibold">Sentry test harness</h1>
      <p className="text-sm text-muted-foreground">
        Use these buttons to confirm the integration is wired up, then delete
        this route.
      </p>

      <div className="flex flex-col gap-2">
        <Button variant="destructive" onClick={throwClientError}>
          Throw unhandled error
        </Button>
        <Button variant="outline" onClick={captureHandledError}>
          captureException (handled)
        </Button>
        <Button variant="outline" onClick={tracedBackendCall}>
          Traced fetch → backend (distributed trace)
        </Button>
      </div>

      {status && (
        <p className="text-sm text-muted-foreground">{status}</p>
      )}
    </div>
  );
}
