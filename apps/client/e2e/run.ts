import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(__dirname, "..");

async function isPortAvailable(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function allocatePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("failed to allocate an ephemeral port"));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function resolvePort(name: "E2E_CLIENT_PORT" | "E2E_SERVER_PORT") {
  const raw = process.env[name];
  if (raw) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      return { port: parsed, reuseExisting: !(await isPortAvailable(parsed)) };
    }
  }
  return { port: await allocatePort(), reuseExisting: false };
}

const client = await resolvePort("E2E_CLIENT_PORT");
const server = await resolvePort("E2E_SERVER_PORT");

process.env.E2E_CLIENT_PORT = String(client.port);
process.env.E2E_SERVER_PORT = String(server.port);
process.env.E2E_REUSE_CLIENT = client.reuseExisting ? "1" : "0";
process.env.E2E_REUSE_SERVER = server.reuseExisting ? "1" : "0";
process.env.E2E_RUN_ID ??= new Date().toISOString().replace(/[:.]/g, "-");

console.log(
  `[e2e] client=${process.env.E2E_CLIENT_PORT} reuseClient=${process.env.E2E_REUSE_CLIENT} server=${process.env.E2E_SERVER_PORT} reuseServer=${process.env.E2E_REUSE_SERVER}`,
);

const subprocess = Bun.spawn(["bunx", "playwright", "test", ...process.argv.slice(2)], {
  cwd: clientDir,
  env: process.env,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(await subprocess.exited);
