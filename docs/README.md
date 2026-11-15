# Teldrive documentation

Static documentation site built with Astro and Fumadocs UI.

## Development

From the repository root:

```bash
just docs-dev
```

Or directly:

```bash
cd docs
bun install --frozen-lockfile
bun run dev
```

## Production build

```bash
just docs-build
```

Astro writes the complete static site to `docs/dist/`. It can be served by any static host or CDN; no Node.js or Next.js runtime is required.

## Content

Documentation lives under `content/docs/` and is organized into:

- `getting-started/` — beginner setup, Telegram application credentials, and first-run verification;
- `installation/` — container, binary, Nix, and source builds;
- `using/` — Drive UI features (files, video player, uploads, sharing, channels, bots, and tasks);
- `rclone/` — native rclone backend setup and mount tuning;
- `configuration/` — security, Telegram, PostgreSQL, uploads, events, and generated option reference;
- `deployment/` — HTTPS/reverse proxy, backups, v1 migration, and production operations;
- `operations/` — health checks, jobs and queues, and symptom-driven troubleshooting;
- `advanced/` — architecture, encryption, performance, and multi-instance operation.

The docs are intentionally grounded in the current Teldrive configuration and repository workflows. Update the relevant page when configuration defaults or deployment behavior changes.
