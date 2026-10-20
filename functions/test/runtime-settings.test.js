const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveStripeSettings } = require('../runtime-settings');
const config = { mode: 'test', stripeTestPublishableKey: 'pk_test_fixture' };

test('public configuration works without private credentials and remains test-only', () => {
  const result = resolveStripeSettings({ config, env: {} });
  assert.equal(result.config.test_publishable, 'pk_test_fixture');
  assert.equal(result.isTest, true);
  assert.equal(result.secret, undefined);
  assert.equal(result.webhookSecret, undefined);
});
test('secrets are read from the bound environment rather than legacy runtime config', () => {
  const result = resolveStripeSettings({ config, env: {
    ASARATI_STRIPE_TEST_SECRET: 'sk_test_fixture', ASARATI_STRIPE_TEST_WEBHOOK_SECRET: 'whsec_fixture',
  } });
  assert.equal(result.secret, 'sk_test_fixture');
  assert.equal(result.webhookSecret, 'whsec_fixture');
  assert.deepEqual(Object.keys(result.config).sort(), ['mode', 'test_publishable']);
});
test('live mode and live keys are rejected instead of silently changing payment mode', () => {
  for (const env of [
    { ASARATI_STRIPE_MODE: 'live' },
    { ASARATI_STRIPE_TEST_PUBLISHABLE_KEY: 'pk_live_fixture' },
    { ASARATI_STRIPE_TEST_SECRET: 'sk_live_fixture' },
    { ASARATI_STRIPE_TEST_WEBHOOK_SECRET: 'invalid' },
  ]) assert.throws(() => resolveStripeSettings({ config, env }));
});
test('missing public configuration fails closed', () => {
  assert.throws(() => resolveStripeSettings({ config: { mode: 'test' }, env: {} }));
});
