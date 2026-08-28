import { hash, verify } from "@node-rs/argon2";
import { createHmac, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

export const hashPassword = (password: string) =>
  hash(password, { algorithm: 2, memoryCost: 19_456, timeCost: 2, outputLen: 32, parallelism: 1 });

export const verifyPassword = (passwordHash: string, password: string) =>
  verify(passwordHash, password);

export const createSessionToken = () => randomBytes(32).toString("base64url");

export const hashSessionToken = (token: string) =>
  createHmac("sha256", env.AUTH_SECRET).update(token).digest("hex");
