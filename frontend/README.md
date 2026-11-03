# LCFS frontend

The frontend uses React, Vite+, Vitest, and Cypress. Node.js is pinned in
`.nvmrc`; pnpm is pinned in `package.json` and the resolved dependency tree
is recorded in `pnpm-lock.yaml`.

Install dependencies from this directory:

```sh
corepack pnpm install --frozen-lockfile
```

Common commands:

```sh
pnpm run dev
pnpm run check
pnpm run test:run
pnpm run test:coverage
pnpm run build
pnpm run cypress:run
```
