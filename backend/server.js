require('dotenv').config();
const app = require('./src/app');
const prisma = require('./src/lib/prisma');

const PORT = process.env.PORT || 3001;

async function main() {
  await prisma.$connect();
  app.listen(PORT, () => {
    console.log(`Server: http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
