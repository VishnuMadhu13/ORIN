# ---------- ORIN API (Express + Socket.IO) ----------
FROM node:22.14.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.14.0-alpine AS runtime
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Local-disk attachments (used when Cloudinary is not configured)
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('net').connect(5000,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"
# Verify this matches the compiled entry point (see DEPLOY.md, step 0)
CMD ["node", "dist/index.js"]
