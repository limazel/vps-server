require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

const USERNAME = process.argv[2] || 'admin';
const PASSWORD = process.argv[3];

if (!PASSWORD) {
  console.error('Usage: node scripts/create-admin.js <username> <password>');
  process.exit(1);
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: USERNAME } });

  if (existing) {
    console.error(`User "${USERNAME}" already exists`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.create({ data: { username: USERNAME, passwordHash } });

  console.log(`Admin created: ${user.username} (id: ${user.id})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
