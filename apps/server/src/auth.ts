import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { db } from "./db/client";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("BETTER_AUTH_SECRET required in production");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  secret: secret ?? "dev-only-insecure-secret-change-me",
  baseURL: process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 2567}`,
  trustedOrigins: ["http://localhost:3000", ...(process.env.TRUSTED_ORIGINS?.split(",") ?? [])],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "player",
        input: false,
      },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
    expiresIn: 60 * 60 * 24 * 7,
  },
  plugins: [bearer()],
});

export type Auth = typeof auth;
