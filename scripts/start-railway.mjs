import { spawn, spawnSync } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");
const config = path.join(root, "dist/server/wrangler.json");
const schema = path.join(root, "deploy/railway-schema.sql");
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(root, ".railway-data");
const publicPort = Number(process.env.PORT || 3000);
const workerPort = Number(process.env.LIFE_ADMIN_WORKER_PORT || 8787);
const username = process.env.LIFE_ADMIN_USERNAME || "";
const password = process.env.LIFE_ADMIN_PASSWORD || "";
const email = process.env.LIFE_ADMIN_EMAIL || "";
const fullName = process.env.LIFE_ADMIN_NAME || "Life Admin";

if (!username || !password || !email) {
  console.error("LIFE_ADMIN_USERNAME, LIFE_ADMIN_PASSWORD, and LIFE_ADMIN_EMAIL are required.");
  process.exit(1);
}
if (!Number.isInteger(publicPort) || publicPort < 1 || publicPort > 65535) {
  console.error("PORT must be a valid TCP port.");
  process.exit(1);
}

mkdirSync(dataDir, { recursive: true });
process.env.WRANGLER_SEND_METRICS ||= "false";
process.env.WRANGLER_WRITE_LOGS ||= "false";
process.env.WRANGLER_LOG_PATH ||= path.join(dataDir, "wrangler/logs");
process.env.WRANGLER_REGISTRY_PATH ||= path.join(dataDir, "wrangler/dev-registry");
process.env.MINIFLARE_REGISTRY_PATH ||= path.join(dataDir, "wrangler/registry");

const sharedArgs = ["--config", config, "--local", "--persist-to", dataDir];
const migration = spawnSync(process.execPath, [wrangler, "d1", "execute", "DB", ...sharedArgs, "--file", schema], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status || 1);

const worker = spawn(process.execPath, [wrangler, "dev", ...sharedArgs, "--ip", "127.0.0.1", "--port", String(workerPort), "--inspector-port", "0"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

const expectedAuthorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
const userId = `railway:${Buffer.from(email.toLowerCase()).toString("base64url")}`;

function authorized(value) {
  if (typeof value !== "string") return false;
  const actual = Buffer.from(value);
  const expected = Buffer.from(expectedAuthorization);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function deny(response) {
  response.writeHead(401, {
    "Cache-Control": "private, no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "WWW-Authenticate": 'Basic realm="Life Admin", charset="UTF-8"',
  });
  response.end("Sign in to Life Admin.");
}

const server = createServer((request, response) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" });
    response.end("ok");
    return;
  }
  if (!authorized(request.headers.authorization)) {
    deny(response);
    return;
  }

  const externalHost = request.headers.host || "";
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(request.method || "GET");
  if (unsafe && request.headers["sec-fetch-site"] === "cross-site") {
    response.writeHead(403, { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" });
    response.end("This request is not allowed.");
    return;
  }
  if (unsafe && request.headers.origin) {
    try {
      if (new URL(request.headers.origin).host !== externalHost) throw new Error("origin mismatch");
    } catch {
      response.writeHead(403, { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" });
      response.end("This request is not allowed.");
      return;
    }
  }

  const headers = { ...request.headers };
  delete headers.authorization;
  for (const name of Object.keys(headers)) {
    if (name.startsWith("oai-authenticated-user-")) delete headers[name];
  }
  headers["oai-authenticated-user-id"] = userId;
  headers["oai-authenticated-user-email"] = email;
  headers["oai-authenticated-user-full-name"] = encodeURIComponent(fullName);
  headers["oai-authenticated-user-full-name-encoding"] = "percent-encoded-utf-8";
  headers["x-forwarded-host"] = request.headers.host || "";
  headers["x-forwarded-proto"] = "https";
  if (headers.origin) headers.origin = `http://${externalHost}`;
  if (unsafe) headers["sec-fetch-site"] = "same-origin";

  const proxyRequest = httpRequest({
    hostname: "127.0.0.1",
    port: workerPort,
    method: request.method,
    path: request.url,
    headers,
  }, (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
    proxyResponse.pipe(response);
  });
  proxyRequest.on("error", () => {
    if (!response.headersSent) response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Life Admin is starting. Please refresh in a moment.");
  });
  request.pipe(proxyRequest);
});

server.listen(publicPort, "0.0.0.0", () => {
  console.log(`Life Admin is listening on port ${publicPort}.`);
});

function shutdown(signal) {
  server.close(() => process.exit(0));
  worker.kill(signal);
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
worker.on("exit", (code, signal) => {
  if (code !== 0) console.error(`Life Admin worker exited (${signal || code}).`);
  server.close(() => process.exit(code || 1));
});
