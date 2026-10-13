import assert from 'node:assert/strict';
import test from 'node:test';
import { runGeneralBenchmark } from '../scripts/reviewintel-general-benchmark.mjs';

for (const layer of ['development', 'holdout', 'reserve']) {
  test(`general ReviewIntel architecture: ${layer}`, async t => {
    const report = await runGeneralBenchmark({ layer });
    assert.deepEqual(report.uncovered, []);
    for (const row of report.cases) {
      await t.test(`${row.id} [${row.kind}]`, () => {
        assert.equal(row.status, 'PASS', row.error);
      });
    }
  });
}
