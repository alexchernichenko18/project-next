import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // 100% in dev so distributed traces always link up with the backend while
  // developing; turn this down (e.g. 0.1) before shipping to prod.
  tracesSampleRate: 1.0,

  // Add `sentry-trace` and `baggage` headers to outgoing requests to these
  // targets so the backend can attach its spans to the same trace.
  tracePropagationTargets: [
    "localhost:3001",
    // TODO: add the production backend domain here, e.g. /^https:\/\/api\.example\.com/
    /^\//,
  ],

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Keep dev replays readable; flip to `true` for prod to avoid PII leaks.
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Hide framework noise from the issue stack — focus on app code.
  sendDefaultPii: false,
});

// Required so Sentry can mark navigation transitions on the App Router timeline.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
