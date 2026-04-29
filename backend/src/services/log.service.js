const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');

const APPS_DIR      = process.env.APPS_DIR      || '/var/www/apps';
const NGINX_LOG_DIR = process.env.NGINX_LOG_DIR || '/var/log/nginx';
const TAIL_LINES    = 300;

// --- helpers ---

function safeTail(filePath) {
  return new Promise((resolve, reject) => {
    // Path is built entirely from env + integer IDs — no user input reaches here
    if (!fs.existsSync(filePath)) {
      return resolve({ lines: [], source: filePath, warning: 'Log file not found' });
    }

    const proc = spawn('tail', ['-n', String(TAIL_LINES), filePath], {
      stdio: 'pipe',
      shell: false,
    });

    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { out += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`tail exited ${code}`));
      resolve({ lines: out.split('\n').filter(Boolean), source: filePath });
    });
  });
}

// --- deploy log ---

async function getDeployLog(siteId) {
  const filePath = path.join(APPS_DIR, String(siteId), 'deploy.log');
  return safeTail(filePath);
}

// --- container log ---

async function getContainerLog(siteId) {
  const name = `site-${siteId}`;

  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['logs', '--tail', String(TAIL_LINES), '--timestamps', name], {
      stdio: 'pipe',
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    // docker logs mixes app output (stdout) and docker output (stderr)
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => {
      if (err.code === 'ENOENT') return reject(new Error('Docker is not installed or not in PATH'));
      reject(err);
    });
    proc.on('close', (code) => {
      if (code !== 0 && !stdout && !stderr) {
        return reject(new Error(`Container "site-${siteId}" not found or not started`));
      }
      const combined = (stdout + stderr).split('\n').filter(Boolean);
      resolve({ lines: combined, container: name });
    });
  });
}

// --- nginx log ---

async function getNginxLog(domain, type) {
  if (!['access', 'error'].includes(type)) throw new Error('type must be access or error');

  // prefer site-specific log, fall back to global
  const specific = path.join(NGINX_LOG_DIR, `${domain}-${type}.log`);
  const global_  = path.join(NGINX_LOG_DIR, `${type}.log`);
  const resolved = fs.existsSync(specific) ? specific : global_;

  return safeTail(resolved);
}

module.exports = { getDeployLog, getContainerLog, getNginxLog };
