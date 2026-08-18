# Dev-only images (ADR-18: production deploys to Vercel, not containers).
# Built locally via `docker compose up --build`; compose picks a service
# with build.target (api | mobile | admin).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# Manifests first so the pnpm install layer caches across code-only changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY apps/mobile/package.json apps/mobile/
COPY apps/admin/package.json apps/admin/
COPY server/api/package.json server/api/
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/

RUN pnpm install --frozen-lockfile

COPY . .

# Workspace packages resolve via their dist/ exports; .dockerignore strips
# host-built dist, so build them here or imports fail inside the container.
RUN pnpm --filter @abra/contracts build

FROM base AS api
EXPOSE 3000
RUN chmod +x server/api/docker-entrypoint.sh
ENTRYPOINT ["server/api/docker-entrypoint.sh"]

FROM base AS mobile
EXPOSE 5173
CMD ["pnpm", "--filter", "@abra/mobile", "dev", "--host", "0.0.0.0", "--port", "5173"]

FROM base AS admin
EXPOSE 5174
CMD ["pnpm", "--filter", "@abra/admin", "dev", "--host", "0.0.0.0", "--port", "5174"]
