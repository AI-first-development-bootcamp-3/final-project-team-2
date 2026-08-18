#!/bin/sh
set -e

# Postgres is already healthy at this point (compose depends_on: service_healthy).
# Generate the Prisma client for this container's platform, then bring the
# schema up to date before starting the API.
pnpm --filter @abra/api exec prisma generate
pnpm --filter @abra/api exec prisma migrate deploy

exec pnpm --filter @abra/api dev
