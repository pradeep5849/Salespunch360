import { hash, verify } from "@node-rs/argon2";

export const hashPassword = (password: string) =>
  hash(password, { algorithm: 2, memoryCost: 19_456, timeCost: 2, outputLen: 32, parallelism: 1 });

export const verifyPassword = (passwordHash: string, password: string) =>
  verify(passwordHash, password);
