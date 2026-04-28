# sub-links edgetunnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/vpn.js` with the current upstream `cmliu/edgetunnel` Worker architecture, patch its defaults for `sub-links`, and deploy it to Cloudflare as Worker `sub-links` with `UUID=179ba8dd-3854-4747-b853-fc1868ef3937`.

**Architecture:** Use `/tmp/cmliu-edgetunnel/_worker.js` as the production code baseline, keep the Worker runtime single-file, and limit local changes to default config values, environment-variable overrides, Wrangler deployment config, tests, and documentation. Verify the migration in three layers: static unit checks, local route/e2e checks, and browser-driven visual/live checks before deployment and PR completion.

**Tech Stack:** Cloudflare Workers, Wrangler, Node.js 24, Playwright, native `node:test`, GitHub CLI.

---

## File Map

- `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/vpn.js`
  - Production Worker source, replaced with upstream `_worker.js` baseline and patched with `sub-links` defaults plus env override glue.
- `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/wrangler.toml`
  - Cloudflare deployment config for Worker `sub-links`, local dev server settings, `UUID` variable, and KV binding.
- `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/package.json`
  - Local scripts for static checks, Playwright e2e/visual runs, Worker dev server, and deploy.
- `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/.gitignore`
  - Ignore local build/test artifacts such as `.wrangler/`, `node_modules/`, and Playwright outputs.
- `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/playwright.config.mjs`
  - Playwright config with a local Wrangler web server and deterministic snapshot paths.
- `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/static-config.test.mjs`
  - Native unit checks for `wrangler.toml`, route migration markers, and README route docs.
- `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/routes.e2e.spec.mjs`
  - Local e2e checks for `/login`, `/admin/config.json`, `/version`, and `/sub`.
- `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/admin-visual.spec.mjs`
  - Pixel-level regression coverage for the login page and admin page.
- `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/admin-visual.spec.mjs-snapshots/login-page.png`
  - Visual baseline snapshot for `/login`.
- `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/admin-visual.spec.mjs-snapshots/admin-page.png`
  - Visual baseline snapshot for `/admin`.
- `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/README.md`
  - Updated usage and deployment docs for `/login`, `/admin`, `/sub`, and Worker `sub-links`.

## Task 1: Create the local Worker harness and static deployment checks

**Files:**
- Create: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/wrangler.toml`
- Create: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/package.json`
- Create: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/.gitignore`
- Create: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/static-config.test.mjs`

- [ ] **Step 1: Create a failing static-config test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relativePath) =>
  fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('wrangler.toml declares the sub-links worker, UUID var, and KV binding', () => {
  const toml = read('wrangler.toml');
  assert.match(toml, /name = "sub-links"/);
  assert.match(toml, /main = "vpn\.js"/);
  assert.match(toml, /\[vars\][\s\S]*UUID = "179ba8dd-3854-4747-b853-fc1868ef3937"/);
  assert.match(toml, /\[\[kv_namespaces\]\][\s\S]*binding = "KV"/);
});
```

- [ ] **Step 2: Run the static test to confirm it fails**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
node --test tests/static-config.test.mjs
```

Expected: FAIL with `ENOENT` because `wrangler.toml` and the `tests/` directory do not exist yet.

- [ ] **Step 3: Write `package.json`, `wrangler.toml`, and `.gitignore`**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npm init -y
npm pkg set name="sub-links-edgetunnel" private=true type="module"
npm pkg set scripts.dev:worker="wrangler dev"
npm pkg set scripts.test:unit="node --test tests/static-config.test.mjs"
npm pkg set scripts.test:e2e="playwright test tests/routes.e2e.spec.mjs"
npm pkg set scripts.test:visual="playwright test tests/admin-visual.spec.mjs"
npm pkg set scripts.test="npm run test:unit && npm run test:e2e && npm run test:visual"
npm pkg set scripts.deploy:sub-links="wrangler deploy"
npm pkg set devDependencies.wrangler="^4.22.0"
npm pkg set devDependencies.@playwright/test="^1.54.2"
```

Apply this patch:

```diff
*** Begin Patch
*** Add File: /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/.gitignore
+node_modules/
+.wrangler/
+playwright-report/
+test-results/
+dist/
*** Add File: /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/wrangler.toml
+name = "sub-links"
+main = "vpn.js"
+compatibility_date = "2026-04-28"
+keep_vars = true
+
+[vars]
+UUID = "179ba8dd-3854-4747-b853-fc1868ef3937"
+
+[dev]
+ip = "127.0.0.1"
+port = 8787
+local_protocol = "http"
+
+[[kv_namespaces]]
+binding = "KV"
*** End Patch
```

- [ ] **Step 4: Install the dev dependencies and Playwright browser**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npm install
npx playwright install chromium
```

Expected: `wrangler` and `@playwright/test` are installed locally, and Chromium is available for later e2e/visual tests.

- [ ] **Step 5: Re-run the unit test**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npm run test:unit
```

Expected: PASS with `1 test` passing.

- [ ] **Step 6: Commit the harness bootstrap**

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
git add package.json package-lock.json .gitignore wrangler.toml tests/static-config.test.mjs
git commit -m "chore: add wrangler and test harness"
```

## Task 2: Replace the legacy Worker source with the upstream route architecture

**Files:**
- Modify: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/vpn.js`
- Modify: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/static-config.test.mjs`

- [ ] **Step 1: Extend the unit test with upstream route assertions**

Apply this patch:

```diff
*** Begin Patch
*** Update File: /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/static-config.test.mjs
@@
 test('wrangler.toml declares the sub-links worker, UUID var, and KV binding', () => {
   const toml = read('wrangler.toml');
   assert.match(toml, /name = "sub-links"/);
   assert.match(toml, /main = "vpn\.js"/);
   assert.match(toml, /\[vars\][\s\S]*UUID = "179ba8dd-3854-4747-b853-fc1868ef3937"/);
   assert.match(toml, /\[\[kv_namespaces\]\][\s\S]*binding = "KV"/);
 });
+
+test('vpn.js is based on the upstream login/admin/sub worker architecture', () => {
+  const source = read('vpn.js');
+  assert.match(source, /访问路径 === 'login'/);
+  assert.match(source, /访问路径 === 'admin'/);
+  assert.match(source, /访问路径 === 'sub'/);
+  assert.match(source, /处理WS请求/);
+  assert.doesNotMatch(source, /\/edit'/);
+});
*** End Patch
```

- [ ] **Step 2: Run the unit test to confirm the route assertions fail**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npm run test:unit
```

Expected: FAIL because the current `vpn.js` still contains the old `/${UUID}` and `/edit` style implementation.

- [ ] **Step 3: Replace `vpn.js` with the upstream `_worker.js` baseline**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
cp /tmp/cmliu-edgetunnel/_worker.js vpn.js
```

- [ ] **Step 4: Re-run the unit test**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npm run test:unit
```

Expected: PASS because `vpn.js` now exposes the upstream login/admin/sub architecture.

- [ ] **Step 5: Commit the source migration baseline**

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
git add vpn.js tests/static-config.test.mjs
git commit -m "refactor: replace vpn worker with upstream baseline"
```

## Task 3: Patch the upstream defaults and add `sub-links` runtime overrides

**Files:**
- Modify: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/vpn.js`
- Create: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/playwright.config.mjs`
- Create: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/routes.e2e.spec.mjs`

- [ ] **Step 1: Create the Playwright config and a failing route e2e test**

Apply this patch:

```diff
*** Begin Patch
*** Add File: /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/playwright.config.mjs
+import { defineConfig } from '@playwright/test';
+
+export default defineConfig({
+  testDir: './tests',
+  timeout: 120000,
+  expect: {
+    timeout: 10000,
+  },
+  use: {
+    baseURL: 'http://127.0.0.1:8787',
+    headless: true,
+    screenshot: 'only-on-failure',
+    trace: 'retain-on-failure',
+  },
+  webServer: {
+    command: 'npm run dev:worker',
+    url: 'http://127.0.0.1:8787/login',
+    reuseExistingServer: true,
+    timeout: 120000,
+  },
+  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
+});
*** Add File: /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/routes.e2e.spec.mjs
+import { test, expect } from '@playwright/test';
+
+const password = '179ba8dd-3854-4747-b853-fc1868ef3937';
+const defaultSub = 'https://sub-nodes.pages.dev/?serect_key=swimmingliu';
+const defaultSubApi = 'https://SUBAPI.fxxk.dedyn.io';
+const defaultSubConfig = 'https://raw.githubusercontent.com/SwimmingLiu/ClashConfig/master/ACL4SSR_Online_Full_MultiMode.ini';
+
+test('login flow exposes the merged upstream config', async ({ page }) => {
+  await page.goto('/login');
+  await expect(page.locator('input[type="password"]')).toBeVisible();
+
+  await page.locator('input[type="password"]').fill(password);
+  await page.locator('button[type="submit"], form button').first().click();
+  await page.waitForURL('**/admin');
+
+  const response = await page.request.get('/admin/config.json');
+  expect(response.ok()).toBeTruthy();
+
+  const config = await response.json();
+  expect(config.UUID).toBe(password);
+  expect(config.优选订阅生成.local).toBe(false);
+  expect(config.优选订阅生成.SUB).toBe(defaultSub);
+  expect(config.订阅转换配置.SUBAPI).toBe(defaultSubApi);
+  expect(config.订阅转换配置.SUBCONFIG).toBe(defaultSubConfig);
+  expect(config.订阅转换配置.SUBEMOJI).toBe(true);
+  expect(typeof config.优选订阅生成.TOKEN).toBe('string');
+  expect(config.优选订阅生成.TOKEN.length).toBeGreaterThan(10);
+});
+
+test('version and sub routes respond under the configured UUID', async ({ page, request }) => {
+  const versionResponse = await request.get('/version?uuid=179ba8dd-3854-4747-b853-fc1868ef3937');
+  expect(versionResponse.ok()).toBeTruthy();
+
+  const versionJson = await versionResponse.json();
+  expect(versionJson.Version).toBeGreaterThan(20260401);
+
+  await page.goto('/login');
+  await page.locator('input[type="password"]').fill(password);
+  await page.locator('button[type="submit"], form button').first().click();
+  await page.waitForURL('**/admin');
+
+  const configResponse = await page.request.get('/admin/config.json');
+  const config = await configResponse.json();
+
+  const subResponse = await page.request.get(`/sub?token=${encodeURIComponent(config.优选订阅生成.TOKEN)}`);
+  expect(subResponse.ok()).toBeTruthy();
+
+  const body = await subResponse.text();
+  expect(body.length).toBeGreaterThan(0);
+});
*** End Patch
```

- [ ] **Step 2: Run the e2e suite and confirm it fails on upstream defaults**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npm run test:e2e
```

Expected: FAIL because the unpatched upstream worker still reports:

- `优选订阅生成.local = true`
- `优选订阅生成.SUB = null`
- `订阅转换配置.SUBAPI = https://SUBAPI.cmliussss.net`
- `订阅转换配置.SUBCONFIG = https://raw.githubusercontent.com/cmliu/ACL4SSR/...`

- [ ] **Step 3: Patch `vpn.js` defaults and env overrides**

Apply this patch:

```diff
*** Begin Patch
*** Update File: /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/vpn.js
@@
-		优选订阅生成: {
-			local: true, // true: 基于本地的优选地址  false: 优选订阅生成器
+		优选订阅生成: {
+			local: false, // true: 基于本地的优选地址  false: 优选订阅生成器
@@
-			SUB: null,
-			SUBNAME: "edge" + "tunnel",
+			SUB: "https://sub-nodes.pages.dev/?serect_key=swimmingliu",
+			SUBNAME: "sub-links",
@@
-		订阅转换配置: {
-			SUBAPI: "https://SUBAPI.cmliussss.net",
-			SUBCONFIG: "https://raw.githubusercontent.com/cmliu/ACL4SSR/refs/heads/main/Clash/config/ACL4SSR_Online_Mini_MultiMode_CF.ini",
-			SUBEMOJI: false,
+		订阅转换配置: {
+			SUBAPI: "https://SUBAPI.fxxk.dedyn.io",
+			SUBCONFIG: "https://raw.githubusercontent.com/SwimmingLiu/ClashConfig/master/ACL4SSR_Online_Full_MultiMode.ini",
+			SUBEMOJI: true,
@@
 	if (!config_JSON.gRPCUserAgent) config_JSON.gRPCUserAgent = UA;
 	config_JSON.HOST = host;
 	if (!config_JSON.HOSTS) config_JSON.HOSTS = [hostname];
 	if (env.HOST) config_JSON.HOSTS = (await 整理成数组(env.HOST)).map(h => h.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0]);
 	config_JSON.UUID = userID;
+	if (env.SUB) config_JSON.优选订阅生成.SUB = env.SUB.startsWith('http') ? env.SUB : `https://${env.SUB}`;
+	if (env.SUBNAME) config_JSON.优选订阅生成.SUBNAME = env.SUBNAME;
+	if (env.SUBAPI) config_JSON.订阅转换配置.SUBAPI = env.SUBAPI.startsWith('http') ? env.SUBAPI : `https://${env.SUBAPI}`;
+	if (env.SUBCONFIG) config_JSON.订阅转换配置.SUBCONFIG = env.SUBCONFIG;
+	if (env.SUBEMOJI !== undefined) config_JSON.订阅转换配置.SUBEMOJI = ['1', 'true', 'yes', 'on'].includes(String(env.SUBEMOJI).toLowerCase());
 	if (!config_JSON.随机路径) config_JSON.随机路径 = false;
 	if (!config_JSON.启用0RTT) config_JSON.启用0RTT = false;
*** End Patch
```

- [ ] **Step 4: Run the e2e suite again**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npm run test:e2e
```

Expected: PASS with both e2e tests green.

- [ ] **Step 5: Commit the `sub-links` runtime behavior patch**

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
git add vpn.js playwright.config.mjs tests/routes.e2e.spec.mjs
git commit -m "feat: patch upstream worker defaults for sub-links"
```

## Task 4: Add visual regression coverage and rewrite the README for the new routes

**Files:**
- Create: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/admin-visual.spec.mjs`
- Create: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/admin-visual.spec.mjs-snapshots/login-page.png`
- Create: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/admin-visual.spec.mjs-snapshots/admin-page.png`
- Modify: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/static-config.test.mjs`
- Modify: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/README.md`

- [ ] **Step 1: Extend the unit test to require new route docs**

Apply this patch:

```diff
*** Begin Patch
*** Update File: /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/static-config.test.mjs
@@
 test('vpn.js is based on the upstream login/admin/sub worker architecture', () => {
   const source = read('vpn.js');
   assert.match(source, /访问路径 === 'login'/);
   assert.match(source, /访问路径 === 'admin'/);
   assert.match(source, /访问路径 === 'sub'/);
   assert.match(source, /处理WS请求/);
   assert.doesNotMatch(source, /\/edit'/);
 });
+
+test('README documents the new sub-links login, admin, and sub routes', () => {
+  const readme = read('README.md');
+  assert.match(readme, /sub-links/i);
+  assert.match(readme, /\/login/);
+  assert.match(readme, /\/admin/);
+  assert.match(readme, /\/sub/);
+  assert.match(readme, /wrangler deploy/);
+});
*** End Patch
```

- [ ] **Step 2: Run the unit test to confirm the README assertions fail**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npm run test:unit
```

Expected: FAIL because `README.md` still documents the old `/${UUID}` flow.

- [ ] **Step 3: Add the visual test and rewrite the README intro/deploy section**

Apply this patch:

```diff
*** Begin Patch
*** Add File: /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/tests/admin-visual.spec.mjs
+import { test, expect } from '@playwright/test';
+
+const password = '179ba8dd-3854-4747-b853-fc1868ef3937';
+
+test('login page visual baseline', async ({ page }) => {
+  await page.goto('/login');
+  await expect(page).toHaveScreenshot('login-page.png', {
+    fullPage: true,
+    animations: 'disabled',
+  });
+});
+
+test('admin page visual baseline', async ({ page }) => {
+  await page.goto('/login');
+  await page.locator('input[type="password"]').fill(password);
+  await page.locator('button[type="submit"], form button').first().click();
+  await page.waitForURL('**/admin');
+  await expect(page).toHaveScreenshot('admin-page.png', {
+    fullPage: true,
+    animations: 'disabled',
+  });
+});
*** Update File: /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/README.md
@@
-# edgetunnel
-这是一个基于 CF Worker 平台的脚本，在原版的基础上修改了显示 VLESS 配置信息转换为订阅内容。使用该脚本，你可以方便地将 VLESS 配置信息使用在线配置转换到 Clash 或 Singbox 等工具中。
+# edgetunnel
+本仓库当前以 Cloudflare Worker `sub-links` 为默认部署目标，运行入口为 `/login`、`/admin`、`/sub`，不再使用旧版 `/${UUID}` 风格入口。
+
+## sub-links 本地开发与部署
+
+1. 安装依赖：
+
+   ```bash
+   cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
+   npm install
+   npx playwright install chromium
+   ```
+
+2. 本地启动 Worker：
+
+   ```bash
+   npm run dev:worker
+   ```
+
+   默认访问地址：`http://127.0.0.1:8787/login`
+
+3. 登录后台：
+
+   - 登录页：`/login`
+   - 后台页：`/admin`
+   - 默认密码：`179ba8dd-3854-4747-b853-fc1868ef3937`
+
+4. 获取订阅：
+
+   - 在 `/admin/config.json` 中读取 `优选订阅生成.TOKEN`
+   - 订阅入口：`/sub?token=<TOKEN>`
+
+5. 部署到 Cloudflare：
+
+   ```bash
+   npm run deploy:sub-links
+   ```
+
+   部署完成后，Worker 名称为 `sub-links`，Wrangler 会自动处理 `KV` 绑定并写回 `wrangler.toml`。
*** End Patch
```

- [ ] **Step 4: Create the visual snapshot baselines**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npx playwright test tests/admin-visual.spec.mjs --update-snapshots
```

Expected: new files are written:

- `tests/admin-visual.spec.mjs-snapshots/login-page.png`
- `tests/admin-visual.spec.mjs-snapshots/admin-page.png`

- [ ] **Step 5: Re-run both the unit and visual suites**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npm run test:unit
npm run test:visual
```

Expected: PASS for all static checks and both screenshot tests.

- [ ] **Step 6: Commit the docs and visual baselines**

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
git add README.md tests/admin-visual.spec.mjs tests/admin-visual.spec.mjs-snapshots tests/static-config.test.mjs
git commit -m "test: add admin visual regression coverage"
```

## Task 5: Run the full local verification stack and deploy to Cloudflare

**Files:**
- Modify if Wrangler writes back IDs: `/Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel/wrangler.toml`

- [ ] **Step 1: Run the complete local verification stack**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npm run test
```

Expected: PASS for:

- `test:unit`
- `test:e2e`
- `test:visual`

- [ ] **Step 2: Deploy Worker `sub-links` to Cloudflare**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npm run deploy:sub-links
```

Expected:

- Wrangler deploys Worker `sub-links`
- a live `workers.dev` URL is printed
- `wrangler.toml` is updated with the real `KV` namespace id if it was auto-provisioned

- [ ] **Step 3: Smoke-test the live Worker over HTTP**

Replace `$WORKER_URL` with the URL printed by Wrangler, then run:

```bash
curl -fsS "$WORKER_URL/version?uuid=179ba8dd-3854-4747-b853-fc1868ef3937"
curl -I "$WORKER_URL/login"
```

Expected:

- `/version` returns JSON with a numeric `Version`
- `/login` returns `HTTP/2 200`

- [ ] **Step 4: Use the live login flow to confirm `/admin/config.json` reflects the patched defaults**

Run:

```bash
node <<'EOF'
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const base = process.env.WORKER_URL;
await page.goto(`${base}/login`);
await page.locator('input[type="password"]').fill('179ba8dd-3854-4747-b853-fc1868ef3937');
await page.locator('button[type="submit"], form button').first().click();
await page.waitForURL('**/admin');
const response = await page.request.get(`${base}/admin/config.json`);
const config = await response.json();
console.log(JSON.stringify({
  local: config.优选订阅生成.local,
  sub: config.优选订阅生成.SUB,
  subApi: config.订阅转换配置.SUBAPI,
  subConfig: config.订阅转换配置.SUBCONFIG
}, null, 2));
await browser.close();
EOF
```

Expected output:

```json
{
  "local": false,
  "sub": "https://sub-nodes.pages.dev/?serect_key=swimmingliu",
  "subApi": "https://SUBAPI.fxxk.dedyn.io",
  "subConfig": "https://raw.githubusercontent.com/SwimmingLiu/ClashConfig/master/ACL4SSR_Online_Full_MultiMode.ini"
}
```

- [ ] **Step 5: Commit the deployed `wrangler.toml` if Wrangler wrote back a real KV id**

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
git add wrangler.toml
git commit -m "chore: record cloudflare kv binding" || echo "No wrangler.toml changes to commit"
```

## Task 6: Open a PR, perform local review, and finish the branch cleanly

**Files:**
- No planned file edits; if review feedback changes code, re-run Task 5 before merging.

- [ ] **Step 1: Push the branch and open a draft PR**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
git push -u origin HEAD
gh pr create --draft --title "feat: migrate sub-links to upstream edgetunnel worker" --body "## Summary
- replace the legacy vpn worker with the current upstream cmliu/edgetunnel worker architecture
- patch upstream defaults for sub-links and add Wrangler deployment config
- add unit, e2e, visual, and live deployment verification

## Test Plan
- npm run test
- npm run deploy:sub-links
- curl \$WORKER_URL/version?uuid=179ba8dd-3854-4747-b853-fc1868ef3937
- browser login to /admin and inspect /admin/config.json
" 
```

Expected: a draft PR URL is printed.

- [ ] **Step 2: Run a local review against `main`**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
git fetch origin main
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
```

Expected:

- `git diff --check` prints no whitespace or merge-marker errors
- the diff stat matches the intended files only

- [ ] **Step 3: If any review or follow-up feedback changes files, rerun the full stack**

Run:

```bash
cd /Users/swimmingliu/data/VPN/cloudflarevpn/edgetunnel
npm run test
npm run deploy:sub-links
```

Expected: PASS again before the PR is marked ready.

- [ ] **Step 4: Mark the PR ready only after all verification is clean**

Run:

```bash
gh pr ready
```

Expected: PR leaves draft state.

- [ ] **Step 5: Merge only after review feedback is resolved**

Run:

```bash
gh pr merge --merge --delete-branch
```

Expected: PR merges and the branch is cleaned up.
