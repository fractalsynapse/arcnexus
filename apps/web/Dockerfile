FROM node:22-bookworm-slim@sha256:170fab707454b1350981adcdc2f536ec21f24d06d7f008e8d40064afeacb8a94 AS node-base

FROM node-base AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm run build

FROM node-base
WORKDIR /app
ENV NODE_ENV=production
ENV ARC_WEB_HOST=0.0.0.0
COPY --from=build /app/package.json ./
COPY --from=build /app/dist/apps/web/src/serve.js /app/dist/apps/web/src/serve-local.js /app/dist/apps/web/src/api-proxy.js ./dist/apps/web/src/
COPY --from=build /app/dist/apps/web/site ./dist/apps/web/site
USER node
CMD ["node", "dist/apps/web/src/serve-local.js", "8080"]
