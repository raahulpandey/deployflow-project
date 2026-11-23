const express = require('express');
const os = require('os');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory state for enterprise microservices & audit logs
let services = [
  { id: 'svc-01', name: 'Core API Gateway', region: 'wsl-local-1a', status: 'Healthy', latency: '12ms', cpu: '14%' },
  { id: 'svc-02', name: 'Auth & IAM Engine', region: 'wsl-local-1a', status: 'Healthy', latency: '18ms', cpu: '9%' },
  { id: 'svc-03', name: 'Telemetry Collector', region: 'wsl-local-1b', status: 'Healthy', latency: '8ms', cpu: '22%' },
  { id: 'svc-04', name: 'Edge Cache Worker', region: 'wsl-local-1b', status: 'Degraded', latency: '64ms', cpu: '41%' }
];

let auditLogs = [
  { time: new Date().toISOString(), actor: 'terraform-engine', action: 'Provisioned container deployflow-server (Ubuntu 22.04)', level: 'INFO' },
  { time: new Date().toISOString(), actor: 'ansible-runner', action: 'Configured Node.js runtime and deployed DeployFlow v1.0', level: 'SUCCESS' },
  { time: new Date().toISOString(), actor: 'nagios-daemon', action: 'Registered HTTP health probe on port 3000', level: 'INFO' }
];

// 1. Health Check Endpoint (Monitored by Nagios)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'DeployFlow Enterprise Portal',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// 2. Real-Time Container System Metrics
app.get('/api/metrics', (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

  res.json({
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    cpuCores: os.cpus().length,
    uptime: Math.floor(os.uptime()),
    memory: {
      totalGB: (totalMem / (1024 ** 3)).toFixed(2),
      usedGB: (usedMem / (1024 ** 3)).toFixed(2),
      percent: memPercent
    }
  });
});

// 3. Get Microservices & Audit Logs
app.get('/api/dashboard', (req, res) => {
  res.json({ services, auditLogs });
});

// 4. Interactive Service Restart / Toggle Action
app.post('/api/services/:id/restart', (req, res) => {
  const svc = services.find(s => s.id === req.params.id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });

  svc.status = 'Healthy';
  svc.latency = `${Math.floor(Math.random() * 14) + 6}ms`;
  svc.cpu = `${Math.floor(Math.random() * 18) + 5}%`;

  auditLogs.unshift({
    time: new Date().toISOString(),
    actor: 'ops-admin',
    action: `Restarted ${svc.name} (${svc.id}) — status verified Healthy`,
    level: 'SUCCESS'
  });

  res.json({ message: `${svc.name} restarted`, service: svc, auditLogs });
});

// 5. Trigger Simulated Pipeline Sync
app.post('/api/pipeline/sync', (req, res) => {
  auditLogs.unshift({
    time: new Date().toISOString(),
    actor: 'ansible-playbook',
    action: 'Executed idempotency check across all active nodes (0 changed, 4 ok)',
    level: 'INFO'
  });
  res.json({ status: 'Synced', auditLogs });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DeployFlow Enterprise Portal running on http://0.0.0.0:${PORT}`);
});