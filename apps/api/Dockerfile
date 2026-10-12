# Depo kökünden derlenir: docker build -f apps/api/Dockerfile .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
RUN npm ci -w apps/api --include-workspace-root --ignore-scripts
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:22-slim
ENV NODE_ENV=production MIGRATIONS_DIR=/app/db/migrations
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci -w apps/api --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY db db
USER node
EXPOSE 8080
# Aynı imaj veritabanı güncellemesi için de kullanılır: node apps/api/dist/migrate.js
CMD ["node", "apps/api/dist/server.js"]
