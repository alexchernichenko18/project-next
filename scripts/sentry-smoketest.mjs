// One-off connectivity check for the Sentry DSN.
// Sends an Error event to the configured project and waits for the network
// flush before exiting. Run with: node --env-file=.env.local scripts/sentry-smoketest.mjs

import * as Sentry from "@sentry/node";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (!dsn) {
  console.error("NEXT_PUBLIC_SENTRY_DSN is not set in the env");
  process.exit(1);
}

Sentry.init({
  dsn,
  environment: "smoketest",
  tracesSampleRate: 0,
});

const eventId = Sentry.captureException(
  new Error(`Sentry smoketest from frontend repo @ ${new Date().toISOString()}`),
);

console.log("Captured event:", eventId);

const flushed = await Sentry.flush(5000);
console.log(flushed ? "Flushed to Sentry ✓" : "Flush timed out ✗");
process.exit(flushed ? 0 : 1);
