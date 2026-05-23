import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
};

export default withSentryConfig(nextConfig, {
  // Org & project slugs are needed for source-map upload. The auth token is
  // read from the `SENTRY_AUTH_TOKEN` env var automatically.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Hide noisy Sentry CLI output during local builds; CI logs stay readable
  // because the plugin still warns/errors on real issues.
  silent: !process.env.CI,

  // Upload source maps for the whole client bundle, not just code Sentry
  // touched — gives us readable stacks for any minified frame.
  widenClientFileUpload: true,
});
