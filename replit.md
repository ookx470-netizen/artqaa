# ارتقاء — Irtiqa

Arabic RTL membership platform with manually reviewed USDT Polygon deposits and withdrawals and fixed daily accrual.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/api-server exec prisma db push` — push Prisma schema (development only)
- `pnpm --filter @workspace/api-server exec node prisma/seed.mjs` — idempotent example plans and settings
- `pnpm --filter @workspace/api-server exec node prisma/promote-admin.mjs <registered-phone>` — operator-only grant of admin access after the owner registers; never make the first public registrant an admin
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Prisma (requested by the user). The unused Drizzle scaffold is not the app schema.
- Validation: generated Zod schemas
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/irtiqa/` — React/Vite/Tailwind frontend
- `artifacts/api-server/prisma/` — Prisma schema and operator scripts
- `artifacts/api-server/src/routes/` — auth, member and admin routes
- `lib/api-spec/openapi.yaml` — API contract (JSON syntax, valid YAML)

## Architecture decisions

- The user explicitly requested name/phone/password accounts, rather than email or social sign-in; preserve that experience.
- The user rejected a demo and chose manual USDT Polygon operations. Binance and OKX are receiving-wallet labels, not API integrations. Admin supplies addresses and daily rates later.
- Earnings are fixed per completed 24-hour period, not tasks or compound interest; terms are snapshotted and capped at 365 days. Honor is administratively adjusted, with no missed-task penalties.
- Legacy simulated balances and subscriptions must never become spendable real balances. Preserve history separately.
- Deposits stay disabled until the operator configures addresses, plans, funding disclosure and terms. No actual funding business has been supplied; never invent one or promise guaranteed returns. Admin must verify the on-chain transfer, not just the screenshot.
- Receipt images use private object storage, direct signed uploads, ownership checks and immutable copies for review. Payouts are external manual transfers, not automatic wallet integrations.
- IDs prefer the final five phone digits; collisions get numeric suffixes. Never reuse the same displayed ID for different members.
- Existing subscriptions preserve the purchased plan terms when an admin edits a plan.

## Product

Public registration requires a valid invitation code from an active member. Existing accounts remain usable and receive a code. Team means direct invited members only; no referral commissions were requested. The owner account is provisioned explicitly, never by making public registration bypass invitations.

Registration/sign-in, annual memberships activated by approved deposits, automatic daily accrual, receipt uploads, manual withdrawals with balance reservation, honor points, profile and activity history. Admins review finance queues and configure plans, wallet addresses, terms and Telegram support.

## User preferences

The user requests Arabic pages with luxurious dark/glass styling, especially login/registration; prominent member ID and honor score; 365-day subscriptions; fixed daily accrual rather than tasks; editable admin plans and honor; About page; floating Telegram support.

## Gotchas

- No public route grants admin. Provision the owner's registered account through the operator command.
- Telegram support is intentionally unconfigured until a real username is supplied.
- Prisma client generation belongs in the build; schema mutations do not. Apply development schema via Prisma, production schema through Publish.
- Do not run the unused Drizzle push against the Prisma-managed tables.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
