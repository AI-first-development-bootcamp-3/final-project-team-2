#!/bin/sh
set -e

# Seam for the database branch (KAN: Prisma schema + migration + seed):
# once Prisma lands, run migrations (and optionally the seed) here, e.g.
#   pnpm --filter @abra/api exec prisma migrate deploy
#   pnpm --filter @abra/api run seed
# Postgres is already healthy at this point (compose depends_on: service_healthy).

exec pnpm --filter @abra/api dev
