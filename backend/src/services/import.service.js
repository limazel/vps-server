const fs      = require('fs');
const path    = require('path');
const prisma  = require('../lib/prisma');
const pm2     = require('./pm2.service');

const NGINX_ENABLED = process.env.NGINX_ENABLED || '/etc/nginx/sites-enabled';

function parseNginxConf(content) {
  const domain = content.match(/server_name\s+([\w.-]+)/)?.[1];
  const port   = content.match(/proxy_pass\s+https?:\/\/[^:]+:(\d+)/)?.[1];
  return { domain: domain || null, port: port ? Number(port) : null };
}

async function scan() {
  let nginxSites = [];
  try {
    const files = fs.readdirSync(NGINX_ENABLED).filter((f) => f.endsWith('.conf'));
    nginxSites = files
      .map((f) => {
        const content = fs.readFileSync(path.join(NGINX_ENABLED, f), 'utf8');
        return { file: f, ...parseNginxConf(content) };
      })
      .filter((s) => s.domain && s.port);
  } catch {}

  let pm2Procs = [];
  try { pm2Procs = await pm2.list(); } catch {}

  const existing = await prisma.site.findMany({ select: { domain: true } });
  const existingSet = new Set(existing.map((s) => s.domain));

  return nginxSites.map((site) => {
    const proc = pm2Procs.find((p) => {
      const envPort = p.pm2_env?.PORT || p.pm2_env?.env?.PORT;
      return Number(envPort) === site.port || p.name === site.domain;
    });

    return {
      domain:          site.domain,
      port:            site.port,
      pm2Name:         proc?.name  || null,
      pm2Status:       proc?.pm2_env?.status || null,
      alreadyImported: existingSet.has(site.domain),
    };
  });
}

module.exports = { scan };
