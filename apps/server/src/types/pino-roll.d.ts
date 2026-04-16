declare module "pino-roll" {
  import type { Writable } from "node:stream";

  interface LimitOptions {
    count?: number;
    removeOtherLogFiles?: boolean;
  }

  interface PinoRollOptions {
    file: string | (() => string);
    size?: string | number;
    frequency?: "daily" | "hourly" | number;
    extension?: string;
    symlink?: boolean;
    limit?: LimitOptions;
    dateFormat?: string;
    mkdir?: boolean;
  }

  export default function pinoRoll(options: PinoRollOptions): Promise<Writable>;
}
