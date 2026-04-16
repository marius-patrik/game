import { resolve } from "node:path";
import pino, { type Logger } from "pino";
import pinoRoll from "pino-roll";

async function createLogger(): Promise<Logger> {
  if (process.env.NODE_ENV !== "production") {
    return pino({
      level: process.env.LOG_LEVEL ?? "info",
      transport: { target: "pino-pretty" },
    });
  }

  const logDir = resolve(process.env.LOG_DIR ?? "logs");
  const rollStream = await pinoRoll({
    file: resolve(logDir, "server.log"),
    frequency: "daily",
    size: "20m",
    mkdir: true,
    limit: { count: 7 },
  });

  return pino(
    { level: process.env.LOG_LEVEL ?? "info" },
    pino.multistream([{ stream: rollStream }, { stream: process.stderr, level: "error" }]),
  );
}

export const log = await createLogger();
