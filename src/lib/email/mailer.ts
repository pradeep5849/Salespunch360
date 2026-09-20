import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

function smtpConfig() {
  if (!env.SMTP_HOST || !env.SMTP_PORT || env.SMTP_SECURE === undefined || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.MAIL_FROM) throw new Error("SMTP_NOT_CONFIGURED");
  return { host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }, from: env.MAIL_FROM };
}
const config = smtpConfig;

function transport() { const value=config(); return nodemailer.createTransport({
  host: value.host,
  port: value.port,
  secure: value.secure,
  auth: value.auth,
}); }

export async function sendTransactionalEmail(to:string|string[],subject:string,text:string){const smtp=config();await transport().sendMail({from:smtp.from,to,subject,text});}

export async function sendVerificationEmail(to: string, token: string) {
  const url = new URL("/verify-email", env.APP_URL);
  url.searchParams.set("token", token);
  const smtp=config();
  await transport().sendMail({
    from: smtp.from,
    to,
    subject: "Verify your SalesPunch360 email",
    text: `Verify your email to unlock employee creation. This link expires in 24 hours: ${url.toString()}`,
    html: `<p>Verify your email to unlock employee creation.</p><p><a href="${url.toString()}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
  });
}

export async function sendPublicInquiry(subject:string,text:string,replyTo:string){const smtp=config();await transport().sendMail({from:smtp.from,to:smtp.from,replyTo,subject,text});}
