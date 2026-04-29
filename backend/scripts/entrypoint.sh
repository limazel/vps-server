#!/bin/sh
set -e

echo "[entrypoint] Running DB migrations..."
npx prisma db push --skip-generate

echo "[entrypoint] Starting server..."
exec node server.js
