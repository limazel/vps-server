const os = require('os');
const si = require('systeminformation');

function toMB(bytes) {
  return Math.round(bytes / 1024 / 1024);
}

async function getStats() {
  const [load, mem, disk, osInfo] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.osInfo(),
  ]);

  const rootDisk = disk.find((d) => d.mount === '/') || disk[0];

  return {
    cpu: {
      usage: Math.round(load.currentLoad * 10) / 10,
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'unknown',
    },
    memory: {
      total: toMB(mem.total),
      used: toMB(mem.used),
      free: toMB(mem.available),
      usagePercent: Math.round((mem.used / mem.total) * 1000) / 10,
    },
    disk: rootDisk
      ? {
          total: toMB(rootDisk.size),
          used: toMB(rootDisk.used),
          free: toMB(rootDisk.size - rootDisk.used),
          usagePercent: Math.round(rootDisk.use * 10) / 10,
          mount: rootDisk.mount,
        }
      : null,
    uptime: {
      seconds: os.uptime(),
      human: formatUptime(os.uptime()),
    },
    os: {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      arch: os.arch(),
      hostname: os.hostname(),
    },
  };
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

module.exports = { getStats };
