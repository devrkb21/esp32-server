# Keeping up with upstream (xinnan-tech/xiaozhi-esp32-server)

This repo is a fork. `prod` follows upstream; `dev` is TinyBot's work on top. Upstream keeps improving the
server (new models, fixes), so every change we make should still merge cleanly when we pull theirs.

## Remotes

```
origin    https://github.com/devrkb21/esp32-server              (ours, push here)
upstream  https://github.com/xinnan-tech/xiaozhi-esp32-server   (theirs, fetch only, push disabled)
```

Set up once on a new machine:

```bash
git remote add upstream https://github.com/xinnan-tech/xiaozhi-esp32-server.git
git remote set-url --push upstream DISABLED
```

## How far behind are we, and what would conflict?

```bash
scripts/upstream-check.sh
```

It fetches upstream and does a dry-run merge into `dev` (nothing is changed): how many upstream commits
we lack, and every file that would conflict, grouped by area.

## Taking an upstream update

1. `scripts/upstream-check.sh` to see the conflicts first.
2. `git switch -c upstream-sync-YYYYMMDD dev` and `git merge upstream/main`.
3. Resolve conflicts, keeping our behaviour (see the rules below for where ours lives).
4. Build and test: manager-api `mvn -q test`, manager-web `npm run build`, xiaozhi-server tests.
5. Merge the branch into `dev`, test on the robot, then release.

Never rebase `dev` onto upstream (it rewrites shared history) and never force-push.

## Rules for our own changes (so merges stay easy)

- **New behaviour goes in new files.** Our features are their own modules
  (`manager-api/.../modules/shopbridge`, `calendar`, `family`, `kids`, ...), their own Vue views and their
  own xiaozhi-server plugins. Upstream never touches these, so they never conflict.
- **Hook in from outside instead of editing upstream files.** Example: the shop bridge adds its Shiro
  filter and URL rules from its own `ShopBridgeShiroConfig` (a bean post-processor), so upstream's
  `ShiroConfig.java` is untouched.
- **When an upstream file must change,** keep the edit small and mark it `// TinyBot:` (or `# TinyBot:`)
  with one line on why, so it is easy to find and re-apply in a conflict.
- **Database changes** only as new Liquibase changesets in new files; never edit an existing changeset.
- **Settings and secrets** come from env or `sys_params`, not hard-coded in upstream config files.

## The shop bridge (TinyBot shop ↔ manager-api)

The TinyBot shop (separate repo `tinybot-shop`) is the one front door: customers sign in there once, and the
robot dashboard (manager-web) opens already signed in. The shop talks to manager-api only through
`/shop-bridge/**`, guarded by its own secret `SHOP_BRIDGE_SECRET` (env), separate from `***REDACTED***`:

| Call | Who | What |
| --- | --- | --- |
| `POST /shop-bridge/session` | shop server | token for a customer, by phone (account made if missing) |
| `POST /shop-bridge/admin-session` | shop server | token for the admin account `SHOP_BRIDGE_ADMIN` |
| `POST /shop-bridge/handoff` | shop server | one-time code (60 s) for a customer's browser |
| `POST /shop-bridge/redeem` | the browser, at `#/sso?code=` | swaps the code for the token (no secret) |

With `SHOP_BRIDGE_SECRET` unset the bridge is off and answers 401.
