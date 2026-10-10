import { installOfflineGuard } from "./reviewintel-offline-guard.mjs";
import { auditRingConnCapture } from "./reviewintel-result-audit.mjs";
installOfflineGuard();
const capturePath = process.argv[2] || "/private/tmp/reviewintel-replay-captures/scan_b5c835b5-e0d7-4f51-b61c-c08d7b619a4b.json";
const originalLog = console.log;
let report;
try {
  console.log = () => {};
  report = auditRingConnCapture(capturePath);
} finally {
  console.log = originalLog;
}
console.log(JSON.stringify(report, null, 2));
