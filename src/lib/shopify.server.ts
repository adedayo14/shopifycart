// Shopify server configuration for Next.js
// This is a simplified version for API routes

export const MONTHLY_PLAN = "Monthly Subscription";
export const ANNUAL_PLAN = "Annual Subscription";

export const BILLING_PLANS = {
  [MONTHLY_PLAN]: {
    amount: 14.99,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    trialDays: 30,
  },
  [ANNUAL_PLAN]: {
    amount: 99,
    currencyCode: "USD",
    interval: "ANNUAL", 
    trialDays: 30,
  },
} as const;

// For testing purposes - reads from environment variable
// Set SHOPIFY_BILLING_TEST_MODE=true for test billing, false for production
export const IS_TEST_BILLING = process.env.SHOPIFY_BILLING_TEST_MODE === 'true';
