import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, runCase, runSuite } from './adversarial-cases.js';

for (const c of CASES) {
  test(`[${c.category}] ${c.id}: ${c.title}`, async () => {
    const r = await runCase(c);
    assert.deepEqual(r.failures, [], r.failures.join('; '));
  });
}

test('suite metrics meet the release acceptance criteria', async () => {
  const { metrics } = await runSuite();
  assert.equal(metrics.criticalFailures, 0, 'zero critical failures');
  assert.equal(metrics.hallucinationCasesReleased, 0, 'no adversarial case may be released');
  assert.equal(metrics.correctAbstentionOrRejectionRate, 1);
  assert.equal(metrics.unsupportedClaimRateInReleased, 0);
  assert.equal(metrics.citationValidityInReleased, 1);
  assert.equal(metrics.honestAnswerAcceptanceRate, 1, 'positive controls must not be falsely rejected');
  assert.ok(metrics.cases >= 45);
});
