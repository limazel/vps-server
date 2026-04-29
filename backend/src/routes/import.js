const router  = require('express').Router();
const prisma  = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const importService    = require('../services/import.service');

router.use(authenticate);

router.get('/scan', async (req, res) => {
  try {
    const sites = await importService.scan();
    res.json({ sites });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { sites } = req.body;
  if (!Array.isArray(sites) || !sites.length)
    return res.status(400).json({ error: 'sites array required' });

  const created = [];
  for (const s of sites) {
    if (!s.domain || !s.port) continue;
    const exists = await prisma.site.findUnique({ where: { domain: s.domain } });
    if (exists) continue;

    const site = await prisma.site.create({
      data: {
        name:    s.domain,
        domain:  s.domain,
        port:    s.port,
        runType: 'pm2',
        pm2Name: s.pm2Name || s.domain,
        status:  s.pm2Status === 'online' ? 'running' : 'stopped',
        appType: 'node',
      },
    });
    created.push(site);
  }

  res.json({ created, count: created.length });
});

module.exports = router;
