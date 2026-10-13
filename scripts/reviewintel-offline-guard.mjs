import { createRequire, syncBuiltinESMExports } from 'node:module';
const require = createRequire(import.meta.url);
export function installOfflineGuard() {
  const fail = () => { process.stderr.write('OFFLINE_REPLAY_EXTERNAL_IO_ATTEMPT\n'); process.exit(86); };
  globalThis.fetch = fail;
  globalThis.WebSocket = fail;
  for (const [module, methods] of Object.entries({http:['request','get'],https:['request','get'],net:['connect','createConnection'],tls:['connect'],http2:['connect'],dns:['lookup','resolve','resolve4','resolve6','reverse'],child_process:['exec','execSync','execFile','execFileSync','spawn','spawnSync','fork']})) {
    const api = require(`node:${module}`); for (const method of methods) api[method] = fail;
  }
  require('node:net').Socket.prototype.connect = fail;
  require('node:dgram').Socket.prototype.send = fail;
  const dns = require('node:dns').promises;
  for (const method of ['lookup','resolve','resolve4','resolve6','reverse']) dns[method] = fail;
  syncBuiltinESMExports();
}
