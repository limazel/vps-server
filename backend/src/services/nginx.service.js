const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');

const NGINX_AVAILABLE = process.env.NGINX_AVAILABLE || '/etc/nginx/sites-available';
const NGINX_ENABLED   = process.env.NGINX_ENABLED   || '/etc/nginx/sites-enabled';

// RFC-compliant domain, no path traversal chars
const DOMAIN_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

function isValidDomain(domain) {
  return typeof domain === 'string' && DOMAIN_RE.test(domain) && domain.length <= 253;
}

// --- config template ---

function buildConfig(domain, port) {
  return `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass          http://127.0.0.1:${port};
        proxy_http_version  1.1;
        proxy_set_header    Upgrade           $http_upgrade;
        proxy_set_header    Connection        'upgrade';
        proxy_set_header    Host              $host;
        proxy_set_header    X-Real-IP         $remote_addr;
        proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto $scheme;
        proxy_cache_bypass  $http_upgrade;
        proxy_read_timeout  60s;
        proxy_send_timeout  60s;
    }
}
`;
}

// --- safe spawn ---

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'pipe', shell: false });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { out += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(out.trim() || `${cmd} exited with code ${code}`));
    });
  });
}

// --- main ---

async function writeConfig(domain, port) {
  if (!isValidDomain(domain))
    throw new Error('Invalid domain');
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Invalid port');

  const confFile    = path.join(NGINX_AVAILABLE, `${domain}.conf`);
  const symlinkFile = path.join(NGINX_ENABLED,   `${domain}.conf`);
  const backupFile  = `${confFile}.bak`;

  const hadConf    = fs.existsSync(confFile);
  const hadSymlink = fs.existsSync(symlinkFile);

  const rollback = () => {
    try {
      if (hadConf) {
        fs.copyFileSync(backupFile, confFile);
      } else if (fs.existsSync(confFile)) {
        fs.unlinkSync(confFile);
      }
      if (!hadSymlink && fs.existsSync(symlinkFile)) {
        fs.unlinkSync(symlinkFile);
      }
    } catch {}
    try { fs.unlinkSync(backupFile); } catch {}
  };

  // backup existing config
  if (hadConf) fs.copyFileSync(confFile, backupFile);

  // write new config
  fs.writeFileSync(confFile, buildConfig(domain, port), 'utf8');

  // create symlink if missing
  if (!hadSymlink) fs.symlinkSync(confFile, symlinkFile);

  // nginx -t
  try {
    await run('nginx', ['-t']);
  } catch (err) {
    rollback();
    throw new Error(`Config test failed: ${err.message}`);
  }

  // nginx reload
  try {
    await run('nginx', ['-s', 'reload']);
  } catch (err) {
    rollback();
    throw new Error(`Nginx reload failed: ${err.message}`);
  }

  try { fs.unlinkSync(backupFile); } catch {}

  return confFile;
}

async function removeConfig(domain) {
  if (!isValidDomain(domain)) throw new Error('Invalid domain');

  const confFile    = path.join(NGINX_AVAILABLE, `${domain}.conf`);
  const symlinkFile = path.join(NGINX_ENABLED,   `${domain}.conf`);

  let removed = false;

  if (fs.existsSync(symlinkFile)) { fs.unlinkSync(symlinkFile); removed = true; }
  if (fs.existsSync(confFile))    { fs.unlinkSync(confFile);    removed = true; }

  if (removed) {
    await run('nginx', ['-t']);
    await run('nginx', ['-s', 'reload']);
  }
}

module.exports = { writeConfig, removeConfig, isValidDomain, buildConfig };
