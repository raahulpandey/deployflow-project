const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let chaosMode = 'healthy'; // 'healthy' | 'outage' | 'latency' | 'degraded'

let services = [
  { id: 'svc-gateway', name: 'Ingress API Gateway', zone: 'bridge-1a', port: 3000, status: 'Healthy', latency: 11, cpu: 12, memoryMB: 84 },
  { id: 'svc-auth', name: 'IAM & Token Engine', zone: 'bridge-1a', port: 3001, status: 'Healthy', latency: 16, cpu: 9, memoryMB: 62 },
  { id: 'svc-telemetry', name: 'Metrics & Probe Worker', zone: 'bridge-1b', port: 3002, status: 'Healthy', latency: 8, cpu: 18, memoryMB: 96 },
  { id: 'svc-cache', name: 'Edge State Cache', zone: 'bridge-1b', port: 6379, status: 'Healthy', latency: 5, cpu: 7, memoryMB: 54 }
];

let releases = [
  { version: 'v2.1.0-prod', commit: '8f4c2a1', author: 'ansible-runner', status: 'Active', deployedAt: 'Just now', notes: 'Chaos engine, live telemetry charts & Nagios deep probes' },
  { version: 'v2.0.4-stable', commit: '3d91e0b', author: 'ansible-runner', status: 'Standby', deployedAt: '2 hours ago', notes: 'Production Express runtime & health endpoint hardening' },
  { version: 'v1.9.0-init', commit: '1a07c4e', author: 'terraform-iac', status: 'Archived', deployedAt: '1 day ago', notes: 'Initial Ubuntu 22.04 container bootstrap' }
];

const formatTime = () => new Date().toLocaleTimeString('en-US', { hour12: false });

let auditTrail = [
  { source: 'terraform-iac', level: 'info', time: formatTime(), message: 'Provisioned deployflow-server (Ubuntu 22.04) on bridge network' },
  { source: 'ansible-runner', level: 'success', time: formatTime(), message: 'Converged playbook.yml — Node.js runtime & v2.1.0-prod active' },
  { source: 'nagios-daemon', level: 'info', time: formatTime(), message: 'Active HTTP probe polling 172.17.0.2:3000/api/health (60s)' }
];

function pushAudit(source, level, message) {
  auditTrail.unshift({ source, level, time: formatTime(), message });
  auditTrail = auditTrail.slice(0, 15);
}

// Rolling 24-point time-series telemetry buffer
const telemetryHistory = [];
function sampleMetrics() {
  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();
  const memPercent = Number(((usedMem / totalMem) * 100).toFixed(1));
  const load = os.loadavg()[0] || 0.15;
  const cpuPercent = Number(Math.min(98, Math.max(4, (load * 25) + (chaosMode === 'outage' ? 42 : chaosMode === 'latency' ? 28 : Math.random() * 8))).toFixed(1));
  const latencyMs = chaosMode === 'outage'
    ? 0
    : chaosMode === 'latency'
      ? Math.floor(2150 + Math.random() * 250)
      : Math.floor(9 + Math.random() * 11);

  telemetryHistory.push({
    time: formatTime(),
    cpu: cpuPercent,
    mem: memPercent,
    latency: latencyMs
  });
  if (telemetryHistory.length > 24) telemetryHistory.shift();
}

// Seed initial history so graphs look populated immediately
for (let i = 0; i < 16; i++) sampleMetrics();
setInterval(sampleMetrics, 3000);

function getDiskUsage() {
  try {
    const out = execSync("df -h / | awk 'NR==2 {print $3 \" / \" $2 \" (\" $5 \")\"}'").toString().trim();
    return out || '4.2G / 50G (9%)';
  } catch {
    return '4.2G / 50G (9%)';
  }
}

// Nagios HTTP Health Check Endpoint (Responds to Chaos Modes)
app.get('/api/health', (req, res) => {
  if (chaosMode === 'outage') {
    return res.status(503).json({
      status: 'CRITICAL',
      nagiosState: 'HARD CRITICAL',
      reason: 'Simulated Upstream Service Outage (Chaos Fault Injection)',
      containerId: os.hostname(),
      timestamp: new Date().toISOString()
    });
  }

  const respondOk = () => {
    res.status(200).json({
      status: 'OK',
      nagiosState: chaosMode === 'latency' ? 'WARNING (HIGH LATENCY)' : 'HARD OK',
      release: (releases.find(r => r.status === 'Active') || {}).version || 'v2.1.0-prod',
      containerId: os.hostname(),
      uptimeSeconds: Math.floor(os.uptime()),
      timestamp: new Date().toISOString()
    });
  };

  if (chaosMode === 'latency') {
    return setTimeout(respondOk, 2200);
  }
  return respondOk();
});

// Full Telemetry Snapshot
app.get('/api/telemetry', (req, res) => {
  const totalMemGB = (os.totalmem() / (1024 ** 3)).toFixed(2);
  const freeMemGB = (os.freemem() / (1024 ** 3)).toFixed(2);
  const usedMemGB = (totalMemGB - freeMemGB).toFixed(2);
  const memPercent = ((usedMemGB / totalMemGB) * 100).toFixed(1);
  const latest = telemetryHistory[telemetryHistory.length - 1] || { cpu: 12, latency: 12 };
  const healthyCount = services.filter(s => s.status === 'Healthy').length;

  res.json({
    cluster: 'wsl-prod-cluster',
    containerId: os.hostname(),
    osRelease: 'Ubuntu 22.04.4 LTS',
    kernel: os.release(),
    nodeVersion: process.version,
    cpuCores: os.cpus().length,
    cpuPercent: latest.cpu,
    latencyMs: latest.latency,
    diskUsage: getDiskUsage(),
    uptimeSeconds: Math.floor(os.uptime()),
    chaosMode,
    memory: { usedGB: usedMemGB, totalGB: totalMemGB, percent: memPercent },
    healthySummary: `${healthyCount} / ${services.length}`,
    services,
    releases,
    history: telemetryHistory,
    auditTrail
  });
});

// Chaos Fault Injection Control
app.post('/api/chaos', (req, res) => {
  const { mode } = req.body;
  if (!['healthy', 'outage', 'latency', 'degraded'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid chaos mode' });
  }

  chaosMode = mode;

  if (mode === 'outage') {
    services = services.map((s, idx) => ({
      ...s,
      status: idx < 2 ? 'Critical' : 'Degraded',
      latency: idx < 2 ? 0 : 480,
      cpu: idx < 2 ? 0 : 78
    }));
    pushAudit('chaos-engine', 'critical', 'FAULT INJECTED: /api/health returning HTTP 503 — Nagios alert triggered');
  } else if (mode === 'latency') {
    services = services.map(s => ({
      ...s,
      status: 'Degraded',
      latency: Math.floor(1800 + Math.random() * 600),
      cpu: Math.floor(55 + Math.random() * 20)
    }));
    pushAudit('chaos-engine', 'warning', 'LATENCY INJECTED: Artificial 2200ms response delay on health probe');
  } else if (mode === 'degraded') {
    services = services.map((s, idx) => ({
      ...s,
      status: idx === 3 ? 'Degraded' : 'Healthy',
      latency: idx === 3 ? 340 : 12,
      cpu: idx === 3 ? 64 : 14
    }));
    pushAudit('chaos-engine', 'warning', 'PARTIAL DEGRADATION: Edge State Cache experiencing high load');
  } else {
    services = services.map(s => ({
      ...s,
      status: 'Healthy',
      latency: Math.floor(7 + Math.random() * 10),
      cpu: Math.floor(8 + Math.random() * 12)
    }));
    pushAudit('ansible-runner', 'success', 'AUTO-HEAL COMPLETE: All services converged to Healthy (HTTP 200 OK)');
  }

  sampleMetrics();
  res.json({ chaosMode, services });
});

// Restart Individual Service
app.post('/api/services/:id/restart', (req, res) => {
  const svc = services.find(s => s.id === req.params.id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });

  svc.status = 'Healthy';
  svc.latency = Math.floor(8 + Math.random() * 9);
  svc.cpu = Math.floor(8 + Math.random() * 10);

  if (services.every(s => s.status === 'Healthy')) {
    chaosMode = 'healthy';
  }

  pushAudit('ansible-runner', 'success', `Restarted ${svc.name} (${svc.id}) — state recovered to Healthy`);
  res.json({ service: svc });
});

// Ansible Full Convergence Sync
app.post('/api/ansible/sync', (req, res) => {
  chaosMode = 'healthy';
  services = services.map(s => ({
    ...s,
    status: 'Healthy',
    latency: Math.floor(7 + Math.random() * 10),
    cpu: Math.floor(8 + Math.random() * 12)
  }));
  sampleMetrics();
  pushAudit('ansible-runner', 'success', 'Executed playbook.yml — zero-downtime state convergence verified');
  res.json({ message: 'Converged' });
});

// Release Rollout & Rollback
app.post('/api/releases/deploy', (req, res) => {
  const nextNum = `v2.${releases.length + 1}.0-canary`;
  const hash = Math.random().toString(16).substring(2, 9);
  releases = releases.map(r => ({ ...r, status: r.status === 'Active' ? 'Standby' : r.status }));
  releases.unshift({
    version: nextNum,
    commit: hash,
    author: 'ansible-runner',
    status: 'Active',
    deployedAt: formatTime(),
    notes: req.body.notes || 'Automated canary rollout via Ansible zero-downtime task'
  });
  releases = releases.slice(0, 6);
  pushAudit('ansible-runner', 'success', `Deployed release ${nextNum} (${hash}) to deployflow-server`);
  res.json({ releases });
});

app.post('/api/releases/rollback', (req, res) => {
  const { version } = req.body;
  releases = releases.map(r => ({
    ...r,
    status: r.version === version ? 'Active' : (r.status === 'Active' ? 'Standby' : r.status),
    deployedAt: r.version === version ? `Rolled back @ ${formatTime()}` : r.deployedAt
  }));
  pushAudit('ansible-runner', 'warning', `Rolled back active production workload to ${version}`);
  res.json({ releases });
});

// Live Container Logs Endpoint
app.get('/api/logs', (req, res) => {
  const logPath = '/var/log/deployflow.log';
  let fileLines = [];
  try {
    if (fs.existsSync(logPath)) {
      fileLines = fs.readFileSync(logPath, 'utf8').trim().split('\n').slice(-25);
    }
  } catch (e) {
    fileLines = [`[warn] Unable to read ${logPath}: ${e.message}`];
  }

  const structured = auditTrail.slice(0, 10).reverse().map(
    a => `[${a.time}] [${a.source.toUpperCase()}] [${a.level.toUpperCase()}] ${a.message}`
  );

  res.json({
    host: os.hostname(),
    logFile: logPath,
    lines: [...fileLines, ...structured]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] DeployFlow v2.0 Enterprise Control Plane listening on port ${PORT}`);
});