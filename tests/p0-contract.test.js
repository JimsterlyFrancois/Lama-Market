import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("server functions use the supported TanStack validator API", async () => {
  const commerce = await read("../src/lib/commerce.js");
  assert.doesNotMatch(commerce, /\.inputValidator\s*\(/);
  assert.match(commerce, /\.validator\s*\(/);
});

test("the application uses Neon Auth and does not declare legacy auth SDKs", async () => {
  const pkg = JSON.parse(await read("../package.json"));
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(dependencies["@neon/auth"]);
  assert.equal(dependencies["@supabase/supabase-js"], undefined);
  assert.equal(dependencies["@base44/sdk"], undefined);
});

test("the official cover and logo are included in the storefront", async () => {
  const home = await read("../src/routes/index.jsx");
  const root = await read("../src/routes/__root.jsx");
  assert.match(home, /\/images\/lama-market-cover\.webp/);
  assert.match(home, /\/images\/lama-market-logo\.svg/);
  assert.match(root, /rel: "icon"/);
  await access(new URL("../public/images/lama-market-cover.webp", import.meta.url));
  await access(new URL("../public/images/lama-market-logo.svg", import.meta.url));
});

test("legacy Base44 and Supabase Auth entry points are absent", async () => {
  for (const path of [
    "../src/api/base44Client.js",
    "../src/lib/supabase.js",
    "../base44/config.jsonc",
  ]) {
    await assert.rejects(access(new URL(path, import.meta.url)));
  }
});

test("server-side permissions are derived from verified Neon identity and database roles", async () => {
  const auth = await read("../src/lib/auth.server.js");
  const commerce = await read("../src/lib/commerce.js");
  assert.match(auth, /jwtVerify\(token, getJwks\(\), \{ issuer \}\)/);
  assert.match(auth, /select role from public\.user_roles where user_id=\$1 and is_active=true/);
  assert.match(commerce, /requireRole\(data\.token, \["admin"\]\)/);
  assert.doesNotMatch(auth, /payload\.role/);
});

test("the animated storefront cover is uploadable only by administrators", async () => {
  const storage = await read("../src/lib/storage.server.js");
  const commerce = await read("../src/lib/commerce.js");
  const admin = await read("../src/routes/admin.jsx");
  const home = await read("../src/routes/index.jsx");
  assert.match(storage, /contentType !== "image\/gif"/);
  assert.match(commerce, /getCoverImageUploadUrl/);
  assert.match(commerce, /requireRole\(data\.token, \["admin"\]\)/);
  assert.match(commerce, /store_settings/);
  assert.match(admin, /accept="image\/gif/);
  assert.match(home, /getStorefrontSettings/);
});
