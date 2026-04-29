const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

const APPS_DIR      = process.env.APPS_DIR      || '/var/www/apps';
const ALLOWED_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org'];

const INTERNAL_PORT = { nextjs: 3000, node: 3000, react: 80, static: 80 };

// --- validation ---

function isValidRepoUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      ALLOWED_HOSTS.includes(u.hostname) &&
      /^\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}

function isValidBranch(branch) {
  return /^[a-zA-Z0-9._/-]+$/.test(branch);
}

// --- safe spawn ---

function run(cmd, args, cwd, onLog) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: 'pipe', shell: false });

    proc.stdout.on('data', (d) => onLog(d.toString()));
    proc.stderr.on('data', (d) => onLog(d.toString()));
    proc.on('error', (err) => reject(new Error(`spawn error: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`'${cmd} ${args[0]}' exited with code ${code}`));
    });
  });
}

async function getCommitSha(cwd) {
  return new Promise((resolve) => {
    const proc = spawn('git', ['rev-parse', '--short', 'HEAD'], { cwd, stdio: 'pipe', shell: false });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.on('close', () => resolve(out.trim()));
    proc.on('error', () => resolve(''));
  });
}

// --- main ---

async function deploy(siteId) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error('Site not found');

  if (!isValidRepoUrl(site.repoUrl))  throw new Error('Invalid repoUrl');
  if (!isValidBranch(site.branch))    throw new Error('Invalid branch name');

  const appDir       = path.join(APPS_DIR, String(siteId));
  const logPath      = path.join(appDir, 'deploy.log');
  const containerName = `site-${siteId}`;
  const imageName     = `site-${siteId}:latest`;
  const internalPort  = INTERNAL_PORT[site.appType] ?? 3000;

  fs.mkdirSync(appDir, { recursive: true });

  const lines = [];
  const log = (msg) => {
    process.stdout.write(msg);
    lines.push(msg);
  };

  const flush = () => fs.writeFileSync(logPath, lines.join(''), 'utf8');

  const deployRecord = await prisma.deploy.create({
    data: { siteId, status: 'pending' },
  });

  await prisma.site.update({ where: { id: siteId }, data: { status: 'deploying' } });

  try {
    log(`=== Deploy started: site ${siteId} ===\n`);

    // git clone / pull
    const hasGit = fs.existsSync(path.join(appDir, '.git'));
    if (hasGit) {
      log('[git] Fetching...\n');
      await run('git', ['fetch', 'origin'],                  appDir, log);
      await run('git', ['checkout', site.branch],            appDir, log);
      await run('git', ['pull', 'origin', site.branch],     appDir, log);
    } else {
      log('[git] Cloning...\n');
      await run('git', [
        'clone', '--branch', site.branch, '--single-branch',
        site.repoUrl, '.',
      ], appDir, log);
    }

    const commitSha = await getCommitSha(appDir);
    log(`[git] HEAD: ${commitSha}\n`);

    // Dockerfile check
    if (!fs.existsSync(path.join(appDir, 'Dockerfile'))) {
      throw new Error('Dockerfile not found in repo root');
    }

    // stop / remove old container
    log('[docker] Removing old container...\n');
    await run('docker', ['stop', containerName], appDir, log).catch(() => {});
    await run('docker', ['rm',   containerName], appDir, log).catch(() => {});

    // build
    log(`[docker] Building ${imageName}...\n`);
    await run('docker', ['build', '-t', imageName, '.'], appDir, log);

    // run
    log(`[docker] Starting container on host port ${site.port}...\n`);
    await run('docker', [
      'run', '-d',
      '--name',    containerName,
      '--restart', 'unless-stopped',
      '-p',        `${site.port}:${internalPort}`,
      imageName,
    ], appDir, log);

    log('=== Deploy successful ===\n');
    flush();

    await prisma.deploy.update({
      where: { id: deployRecord.id },
      data:  { status: 'success', commitSha, log: lines.join('') },
    });
    await prisma.site.update({
      where: { id: siteId },
      data:  { status: 'running' },
    });

    return deployRecord.id;

  } catch (err) {
    log(`\n[error] ${err.message}\n`);
    flush();

    await prisma.deploy.update({
      where: { id: deployRecord.id },
      data:  { status: 'failed', log: lines.join('') },
    });
    await prisma.site.update({
      where: { id: siteId },
      data:  { status: 'failed' },
    });

    throw err;
  }
}

module.exports = { deploy, isValidRepoUrl };
