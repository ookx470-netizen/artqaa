#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server exec prisma generate
pnpm --filter @workspace/api-server exec prisma db push
pnpm --filter @workspace/api-server exec node prisma/seed.mjs
