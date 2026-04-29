const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getStats } = require('../services/system.service');

router.get('/stats', authenticate, async (req, res) => {
  const stats = await getStats();
  res.json(stats);
});

module.exports = router;
