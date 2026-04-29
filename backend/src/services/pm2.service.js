const { spawn } = require('child_process');

function run(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('pm2', args, { stdio: 'pipe', shell: false });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { out += d.toString(); });
    proc.on('error', (err) => reject(new Error(err.code === 'ENOENT' ? 'pm2 bulunamadı' : err.message)));
    proc.on('close', (code) => code === 0 ? resolve(out.trim()) : reject(new Error(out.trim())));
  });
}

async function list() {
  const out = await run(['jlist']);
  try { return JSON.parse(out); } catch { return []; }
}

async function control(name, action) {
  return run([action, name, '--no-color']);
}

module.exports = { list, control };
