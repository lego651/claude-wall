const { withSentryConfig } = require('@sentry/nextjs');

// Allow Supabase Storage (e.g. firm logos) in next/image
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let supabaseHost = null;
try {
  if (supabaseUrl) supabaseHost = new URL(supabaseUrl).hostname;
} catch (_) {}

const remotePatterns = [
  { protocol: "https", hostname: "lh3.googleusercontent.com" },
  { protocol: "https", hostname: "pbs.twimg.com" },
  { protocol: "https", hostname: "images.unsplash.com" },
  { protocol: "https", hostname: "logos-world.net" },
  { protocol: "https", hostname: "ui-avatars.com" },
];
if (supabaseHost) {
  remotePatterns.push({ protocol: "https", hostname: supabaseHost });
}

const nextConfig = {
  reactStrictMode: true,
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns,
  },
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
  webpack: (config, { webpack, isServer }) => {
    // Suppress specific warnings from Supabase realtime-js and Edge Runtime compatibility
    config.ignoreWarnings = [
      {
        module: /node_modules\/@supabase\/realtime-js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
      {
        module: /node_modules\/@supabase\/realtime-js/,
        message: /A Node\.js API is used \(process\.versions/,
      },
      {
        module: /node_modules\/@supabase\/realtime-js/,
        message: /A Node\.js API is used \(process\.version/,
      },
      {
        module: /node_modules\/@supabase\/supabase-js/,
        message: /A Node\.js API is used \(process\.version/,
      },
    ];

    return config;
  },
};

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
};

module.exports =
  process.env.SENTRY_DSN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
    : nextConfig;
