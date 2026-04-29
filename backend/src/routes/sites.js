const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const deployService = require('../services/deploy.service');
const nginxService  = require('../services/nginx.service');
const sslService    = require('../services/ssl.service');
const logService    = require('../services/log.service');
const pm2Service    = require('../services/pm2.service');

const APP_TYPES = ['nextjs', 'react', 'node', 'static'];
const STATUSES  = ['pending', 'deploying', 'running', 'stopped', 'failed'];
const PORT_MIN  = 4001;
const PORT_MAX  = 4999;

router.use(authenticate);

// --- helpers ---

function fail(res, status, message, detail = null) {
  const body = { error: message };
  if (detail) body.detail = detail;
  return res.status(status).json(body);
}

function validateCreate(body) {
  const errors = {};
  const { name, domain, repoUrl, appType } = body;

  if (!name?.trim())           errors.name    = 'Required';
  if (!domain?.trim())         errors.domain  = 'Required';
  if (!repoUrl?.trim())        errors.repoUrl = 'Required';
  if (!appType)                errors.appType = 'Required';
  else if (!APP_TYPES.includes(appType))
    errors.appType = `Must be one of: ${APP_TYPES.join(', ')}`;

  if (domain && !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain.trim()))
    errors.domain = 'Invalid domain format';

  return Object.keys(errors).length ? errors : null;
}

function validatePatch(body) {
  const errors = {};
  const { appType, status, domain } = body;

  if (appType !== undefined && !APP_TYPES.includes(appType))
    errors.appType = `Must be one of: ${APP_TYPES.join(', ')}`;

  if (status !== undefined && !STATUSES.includes(status))
    errors.status = `Must be one of: ${STATUSES.join(', ')}`;

  if (domain !== undefined && !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain.trim()))
    errors.domain = 'Invalid domain format';

  return Object.keys(errors).length ? errors : null;
}

async function assignPort() {
  const used = await prisma.site.findMany({
    where:   { port: { not: null } },
    select:  { port: true },
    orderBy: { port: 'asc' },
  });
  const set = new Set(used.map((s) => s.port));
  for (let p = PORT_MIN; p <= PORT_MAX; p++) {
    if (!set.has(p)) return p;
  }
  throw new Error('No available ports in range');
}

// --- routes ---

router.get('/', async (req, res) => {
  const sites = await prisma.site.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ sites });
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 400, 'Invalid id');

  const site = await prisma.site.findUnique({
    where:   { id },
    include: { deploys: { orderBy: { deployedAt: 'desc' }, take: 10 } },
  });
  if (!site) return fail(res, 404, 'Site not found');

  res.json({ site });
});

router.post('/', async (req, res) => {
  const errors = validateCreate(req.body);
  if (errors) return res.status(400).json({ errors });

  const { name, domain, repoUrl, branch, appType } = req.body;

  const duplicate = await prisma.site.findUnique({ where: { domain: domain.trim() } });
  if (duplicate) return fail(res, 409, 'Domain already in use');

  const port = await assignPort();

  const site = await prisma.site.create({
    data: {
      name:    name.trim(),
      domain:  domain.trim(),
      repoUrl: repoUrl.trim(),
      branch:  branch?.trim() || 'main',
      appType,
      port,
      status: 'pending',
    },
  });

  res.status(201).json({ site });
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 400, 'Invalid id');

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return fail(res, 404, 'Site not found');

  const errors = validatePatch(req.body);
  if (errors) return res.status(400).json({ errors });

  const { name, domain, repoUrl, branch, appType, status } = req.body;

  if (domain && domain.trim() !== site.domain) {
    const duplicate = await prisma.site.findUnique({ where: { domain: domain.trim() } });
    if (duplicate) return fail(res, 409, 'Domain already in use');
  }

  const data = {};
  if (name    !== undefined) data.name    = name.trim();
  if (domain  !== undefined) data.domain  = domain.trim();
  if (repoUrl !== undefined) data.repoUrl = repoUrl.trim();
  if (branch  !== undefined) data.branch  = branch.trim();
  if (appType !== undefined) data.appType = appType;
  if (status  !== undefined) data.status  = status;

  if (!Object.keys(data).length) return fail(res, 400, 'No fields to update');

  const updated = await prisma.site.update({ where: { id }, data });
  res.json({ site: updated });
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 400, 'Invalid id');

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return fail(res, 404, 'Site not found');

  await prisma.site.delete({ where: { id } });
  res.json({ message: 'Deleted' });
});

router.post('/:id/deploy', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 400, 'Invalid id');

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return fail(res, 404, 'Site not found');

  if (!deployService.isValidRepoUrl(site.repoUrl))
    return fail(res, 422, 'Site repoUrl is not a valid HTTPS GitHub/GitLab/Bitbucket URL');

  if (site.status === 'deploying')
    return fail(res, 409, 'Deploy already in progress');

  deployService.deploy(id).catch((err) =>
    console.error(`[deploy] site ${id} failed:`, err.message)
  );

  res.status(202).json({ message: 'Deploy started', siteId: id });
});

router.post('/:id/nginx', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 400, 'Invalid id');

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return fail(res, 404, 'Site not found');

  if (!site.port)
    return fail(res, 422, 'Site has no assigned port');

  if (!nginxService.isValidDomain(site.domain))
    return fail(res, 422, 'Site domain is invalid');

  try {
    const confPath = await nginxService.writeConfig(site.domain, site.port);
    res.json({ message: 'Nginx config applied', config: confPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/ssl', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 400, 'Invalid id');

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return fail(res, 404, 'Site not found');

  if (!nginxService.isValidDomain(site.domain))
    return fail(res, 422, 'Site domain is invalid');

  try {
    const output = await sslService.installSsl(site.domain);
    res.json({ message: 'SSL installed', domain: site.domain, output });
  } catch (err) {
    const status = err.message.includes('not configured') ? 500
                 : err.message.includes('not found')     ? 422
                 : 500;
    res.status(status).json({ error: err.message });
  }
});

// --- container/pm2 control ---

async function controlSite(site, action) {
  if (site.runType === 'pm2') {
    await pm2Service.control(site.pm2Name || site.domain, action);
  } else {
    const { spawn } = require('child_process');
    await new Promise((resolve, reject) => {
      const proc = spawn('docker', [action, `site-${site.id}`], { stdio: 'pipe', shell: false });
      proc.on('error', reject);
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`docker ${action} failed`)));
    });
  }
}

for (const action of ['start', 'stop', 'restart']) {
  router.post(`/:id/${action}`, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return fail(res, 400, 'Invalid id');

    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) return fail(res, 404, 'Site not found');

    try {
      await controlSite(site, action);
      const status = action === 'stop' ? 'stopped' : 'running';
      await prisma.site.update({ where: { id }, data: { status } });
      res.json({ message: `${action} successful` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// --- log endpoints ---

router.get('/:id/logs/deploy', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 400, 'Invalid id');

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return fail(res, 404, 'Site not found');

  try {
    const result = await logService.getDeployLog(id);
    res.json({ ...result, siteId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/logs/container', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 400, 'Invalid id');

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return fail(res, 404, 'Site not found');

  try {
    const result = await logService.getContainerLog(id);
    res.json({ ...result, siteId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/logs/nginx', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 400, 'Invalid id');

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return fail(res, 404, 'Site not found');

  const type = req.query.type === 'access' ? 'access' : 'error';

  try {
    const result = await logService.getNginxLog(site.domain, type);
    res.json({ ...result, siteId: id, type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
