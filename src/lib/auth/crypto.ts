import { createHmac, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
export { hashPassword, verifyPassword } from "./password";

export const createSessionToken = () => randomBytes(32).toString("base64url");

export const hashSessionToken = (token: string) =>
  createHmac("sha256", env.AUTH_SECRET).update(token).digest("hex");
