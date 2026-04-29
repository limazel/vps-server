const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { isValidDomain } = require('./nginx.service');

const NGINX_AVAILABLE = process.env.NGINX_AVAILABLE || '/etc/nginx/sites-available';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'pipe', shell: false });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { out += d.toString(); });
    proc.on('error', (err) => reject(new Error(`spawn error: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(out.trim() || `certbot exited with code ${code}`));
    });
  });
}

async function installSsl(domain) {
  if (!isValidDomain(domain))
    throw new Error('Invalid domain');

  const email = process.env.CERTBOT_EMAIL;
  if (!email || !email.includes('@'))
    throw new Error('CERTBOT_EMAIL is not configured in environment');

  const confFile = path.join(NGINX_AVAILABLE, `${domain}.conf`);
  if (!fs.existsSync(confFile))
    throw new Error(`Nginx config not found for "${domain}". Call POST /nginx first.`);

  const output = await run('certbot', [
    '--nginx',
    '--non-interactive',
    '--agree-tos',
    '--redirect',
    '--email', email,
    '-d',      domain,
  ]);

  return output;
}

module.exports = { installSsl };
