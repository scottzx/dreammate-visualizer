import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'darwin') throw new Error('此服务托管脚本仅支持 macOS；其他系统请使用对应的进程管理器。');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const label = 'com.1agents.dreammate-visualizer';
const domain = `gui/${process.getuid()}`;
const target = `${domain}/${label}`;
const plistPath = path.join(homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
const logs = path.join(homedir(), 'Library', 'Logs', 'DreamMateVisualizer');
const action = process.argv[2];
const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
function launchctl(args, optional = false) {
  const result = spawnSync('/bin/launchctl', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (!optional && result.status !== 0) throw new Error((result.stderr || result.stdout).trim() || `launchctl ${args[0]} failed`);
  return result;
}
if (action === 'install') {
  await access(path.join(root, 'dist', 'index.html'));
  await access(path.join(root, 'node_modules', 'tsx', 'package.json'));
  await mkdir(path.dirname(plistPath), { recursive: true });
  await mkdir(logs, { recursive: true });
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>--import</string><string>tsx</string><string>${xml(path.join(root, 'src', 'server', 'index.ts'))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>EnvironmentVariables</key><dict><key>NODE_ENV</key><string>production</string><key>OBSERVER_CONFIG</key><string>${xml(path.join(root, 'observer.config.json'))}</string><key>PATH</key><string>${xml([path.dirname(process.execPath), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':'))}</string></dict>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
<key>ProcessType</key><string>Interactive</string>
<key>StandardOutPath</key><string>${xml(path.join(logs, 'observer.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(logs, 'observer-error.log'))}</string>
</dict></plist>
`;
  await writeFile(plistPath, plist, { mode: 0o600 });
  if (launchctl(['print', target], true).status === 0) launchctl(['bootout', target]);
  launchctl(['enable', target]);
  // bootout may return before launchd has finished releasing the old job.
  // A short bounded retry avoids a transient bootstrap I/O error during upgrades.
  let registered = false;
  let bootstrapError = '';
  for (let attempt = 0; attempt < 6; attempt++) {
    const result = launchctl(['bootstrap', domain, plistPath], true);
    if (result.status === 0) { registered = true; break; }
    bootstrapError = (result.stderr || result.stdout).trim();
    if (result.status !== 5) break;
    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
  if (!registered) throw new Error(bootstrapError || '无法注册 launchd 观察服务');
  console.log(`已安装用户级服务 ${label}\n配置：${plistPath}\n日志：${logs}\n登录后自动运行，进程退出后由 launchd 重启。`);
} else if (action === 'status') {
  const result = launchctl(['print', target], true);
  if (result.status !== 0) { console.log('观察服务尚未由 launchd 托管。'); process.exitCode = 1; }
  else console.log(result.stdout);
} else if (action === 'uninstall') {
  if (launchctl(['print', target], true).status === 0) launchctl(['bootout', target]);
  await rm(plistPath, { force: true });
  console.log(`已停止并移除 ${label} 的用户级托管，项目、配置与日志保留。`);
} else throw new Error('用法：node scripts/service.mjs install|status|uninstall');
