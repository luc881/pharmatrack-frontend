# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (hot-reload on http://localhost:3030)
yarn dev

# Production build
yarn build

# Run all tests (watch mode)
yarn test

# Run a single test file
yarn test src/test/auth/sign-in.test.jsx

# Test with coverage
yarn test:coverage

# Lint
yarn lint
yarn lint:fix

# Format
yarn fm:check
yarn fm:fix

# Lint + format together
yarn fix:all
```

Node ≥ 22.12.0 required. Prefer `yarn` over `npm`.

## Environment

Create `.env.local` in the project root:

```env
VITE_SERVER_URL=http://localhost:8000   # or https://api.farmaciaselene.com
```

`VITE_SERVER_URL` is the only env var required for JWT auth (the active auth method).

## Architecture

### Data layer — `src/lib/axios.js` + `src/actions/`

All HTTP calls go through a single `axiosInstance` configured with `CONFIG.serverUrl`. It handles:
- 429 retry (waits `retry-after` header seconds, then retries once)
- Error normalization (extracts `detail` or `message` from response body)

`fetcher` is the SWR-compatible wrapper around `axiosInstance.get`. All API endpoints are defined in the `endpoints` object in `src/lib/axios.js`.

`src/actions/` contains one file per domain. Each file exports:
- `useGetX()` — SWR hooks for reads (named pattern: `useGetX`, return `{ xData, xLoading, xError, xMutate }`)
- `createX / updateX / deleteX` — plain async functions for mutations (return `res.data`)

SWR is configured globally with `revalidateIfStale: false`, `revalidateOnFocus: false`, `revalidateOnReconnect: false` — data only refreshes on explicit `mutate()` calls or page reload.

### Auth — `src/auth/context/jwt/`

Active auth method is `jwt` (set in `src/global-config.js`). Other providers (Amplify, Firebase, Supabase, Auth0) exist in the codebase but are unused.

Token storage:
- Access token → `sessionStorage['jwt_access_token']`
- Refresh token → `sessionStorage['jwt_refresh_token']` (or `localStorage` if "remember me" was checked)

`setSession(token)` in `src/auth/context/jwt/utils.js` sets the `Authorization` header on `axiosInstance.defaults` and schedules an automatic refresh 60 seconds before the access token expires. Calling `setSession(null)` clears everything and cancels the timer.

The JWT payload must contain `{ id, sub (email), role, permissions[] }`. Permissions are embedded at token-creation time by the backend.

### Routing & authorization — `src/routes/`

Routes are defined in `src/routes/sections/dashboard.jsx` using React Router 7. All page components are lazy-loaded via `React.lazy`.

Two guard layers:
1. `AuthGuard` — redirects unauthenticated users to sign-in
2. `RoleBasedGuard` — checks `allowedPermissions` against `user.permissions[]` from the JWT. Permission strings follow the format `'{resource}.{action}'` (e.g. `'users.read'`, `'branches.create'`). The `P` constant in `dashboard.jsx` maps readable names to permission arrays. Use the `guard(P.somePermission, <Element />)` helper when adding protected routes.

`CONFIG.auth.skip = false` (in `global-config.js`) — setting it to `true` bypasses `AuthGuard` for local testing without credentials.

### Page structure

Each module follows this layout:
- `src/pages/dashboard/{module}/` — thin page components (just imports and renders the section view)
- `src/sections/{module}/` — the actual views, forms, table components
- `src/actions/{module}.js` — SWR hooks and mutation functions

### Tests — `src/test/`

Tests use Vitest + Testing Library + MSW. The MSW server is started globally in `src/test/setup.js`. Add request handlers in `src/test/mocks/handlers.js` for baseline mocks; add per-test handlers via `server.use(...)` inside individual test files.

Path alias `src/` resolves to `./src/` in both Vite and Vitest configs.
