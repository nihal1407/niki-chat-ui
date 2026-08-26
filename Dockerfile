# J.A.R.V.I.S. Chat UI — Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY server.js package*.json ./
COPY public ./public
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]