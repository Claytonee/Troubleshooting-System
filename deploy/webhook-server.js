#!/usr/bin/env node
/**
 * GitHub Webhook Receiver for QFT Technical Support System
 *
 * Listens for GitHub push events and triggers deployment
 * based on which branch was pushed.
 *
 * Branch → Environment mapping:
 *   main     → production
 *   staging  → staging
 *   develop  → development
 */

const http = require('http');
const crypto = require('crypto');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || '';
const APP_DIR = process.env.APP_DIR || path.resolve(__dirname, '..');
const LOG_FILE = path.join(__dirname, 'deploy.log');

const BRANCH_ENV_MAP = {
  'refs/heads/main': 'production',
  'refs/heads/staging': 'staging',
  'refs/heads/develop': 'development',
};

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function verifySignature(payload, signature) {
  if (!SECRET) return true;
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payload);
  const digest = 'sha256=' + hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

function deploy(environment) {
  const scriptName = `deploy-${environment}.sh`;
  const scriptPath = path.join(__dirname, scriptName);

  if (!fs.existsSync(scriptPath)) {
    log(`ERROR: Deploy script not found: ${scriptPath}`);
    return false;
  }

  log(`Starting ${environment} deployment...`);

  exec(`bash "${scriptPath}"`, { cwd: APP_DIR, timeout: 300000 }, (err, stdout, stderr) => {
    if (err) {
      log(`DEPLOY FAILED [${environment}]: ${err.message}`);
      log(`stderr: ${stderr}`);
    } else {
      log(`DEPLOY SUCCESS [${environment}]`);
    }
    if (stdout) log(`stdout: ${stdout}`);
  });

  return true;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const signature = req.headers['x-hub-signature-256'] || '';
    if (SECRET && !verifySignature(body, signature)) {
      log('REJECTED: Invalid webhook signature');
      res.writeHead(403);
      res.end('Invalid signature');
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      res.writeHead(400);
      res.end('Invalid JSON');
      return;
    }

    const event = req.headers['x-github-event'];
    if (event !== 'push') {
      log(`Ignoring event: ${event}`);
      res.writeHead(200);
      res.end('Ignored');
      return;
    }

    const ref = payload.ref;
    const environment = BRANCH_ENV_MAP[ref];
    if (!environment) {
      log(`Ignoring push to untracked branch: ${ref}`);
      res.writeHead(200);
      res.end('Branch not tracked');
      return;
    }

    const pusher = payload.pusher?.name || 'unknown';
    const commitMsg = payload.head_commit?.message || '';
    log(`Push received: ${ref} by ${pusher} — "${commitMsg.split('\n')[0]}"`);

    const started = deploy(environment);
    res.writeHead(started ? 202 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: started ? 'deploying' : 'error',
      environment,
      branch: ref,
    }));
  });
});

server.listen(PORT, () => {
  log(`Webhook server listening on port ${PORT}`);
  log(`Tracking branches: ${Object.keys(BRANCH_ENV_MAP).map(r => r.replace('refs/heads/', '')).join(', ')}`);
});
