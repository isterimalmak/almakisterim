# Depo kökünden derlenir: docker build -f apps/web/Dockerfile --build-arg API_ORIGIN=https://... .
FROM node:22-slim AS build
WORKDIR /app
ARG API_ORIGIN
ENV API_ORIGIN=$API_ORIGIN NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web --include-workspace-root --ignore-scripts
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM node:22-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8080
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static apps/web/.next/static
USER node
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
