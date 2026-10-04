import { environmentSchema } from "./environment-schema";
export { environmentSchema } from "./environment-schema";
export const env = environmentSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  APP_URL:
    process.env.APP_URL ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "http://localhost:3000"),
  TRUST_PROXY: process.env.TRUST_PROXY ?? "false",
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER ?? "UNCONFIGURED",
  STORAGE_DRIVER: process.env.STORAGE_DRIVER ?? "hostinger",
  HOSTINGER_STORAGE_PATH: process.env.HOSTINGER_STORAGE_PATH,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  MAIL_FROM: process.env.MAIL_FROM,
});
