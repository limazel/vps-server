FROM node:20-alpine

RUN apk add --no-cache git docker-cli certbot openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
RUN npx prisma generate

COPY src      ./src
COPY server.js ./
COPY scripts  ./scripts

RUN mkdir -p /app/data

COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/entrypoint.sh"]
