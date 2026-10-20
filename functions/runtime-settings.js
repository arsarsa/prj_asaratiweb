const defaultConfig = require('./runtime-public-config.json');

// These functions remain deliberately test-only during the QRC pilot.
// Private values are supplied by Secret Manager, never by this JSON file.
function resolveStripeSettings({ env = process.env, config = defaultConfig } = {}) {
  const mode = env.ASARATI_STRIPE_MODE || config.mode;
  if (mode !== 'test') throw new Error('Stripe live mode is not enabled for this deployment.');
  const publishable = env.ASARATI_STRIPE_TEST_PUBLISHABLE_KEY || config.stripeTestPublishableKey;
  const secret = env.ASARATI_STRIPE_TEST_SECRET;
  const webhookSecret = env.ASARATI_STRIPE_TEST_WEBHOOK_SECRET;
  if (!publishable?.startsWith('pk_test_')) throw new Error('Stripe test publishable key is missing or invalid.');
  if (secret && !secret.startsWith('sk_test_')) throw new Error('Stripe test secret is invalid.');
  if (webhookSecret && !webhookSecret.startsWith('whsec_')) throw new Error('Stripe test webhook secret is invalid.');
  return {
    config: { mode: 'test', test_publishable: publishable },
    isTest: true, secret, webhookSecret,
  };
}
module.exports = { resolveStripeSettings };
