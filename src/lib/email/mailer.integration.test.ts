import { createServer, type Server, type Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configuration = vi.hoisted(() => ({
  APP_URL: "http://localhost:3000",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: 0,
  SMTP_SECURE: false,
  SMTP_USER: "fixture-smtp-user",
  SMTP_PASSWORD: "fixture-smtp-password",
  MAIL_FROM: "SalesPunch360 <sender@example.invalid>",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: configuration }));
import {
  sendPublicInquiry,
  sendTransactionalEmail,
  sendVerificationEmail,
} from "./mailer";

type Message = { recipients: string[]; data: string };
let server: Server;
let sockets: Set<Socket>;
let messages: Message[];
let rejectAuthentication: boolean;
let authentication: string;

beforeEach(async () => {
  sockets = new Set();
  messages = [];
  rejectAuthentication = false;
  authentication = "";
  server = createServer((socket) => {
    sockets.add(socket);
    socket.setEncoding("utf8");
    socket.on("close", () => sockets.delete(socket));
    let buffer = "",
      collecting = false,
      recipients: string[] = [],
      data: string[] = [];
    socket.write("220 localhost synthetic SMTP fixture\r\n");
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n"),
          line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (collecting) {
          if (line === ".") {
            messages.push({
              recipients: [...recipients],
              data: data.join("\r\n"),
            });
            collecting = false;
            socket.write("250 accepted locally; never relayed\r\n");
          } else data.push(line);
        } else if (/^EHLO|^HELO/.test(line))
          socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
        else if (line.startsWith("AUTH PLAIN ")) {
          authentication = Buffer.from(line.slice(11), "base64").toString();
          socket.write(
            rejectAuthentication
              ? "535 Authentication rejected by fixture\r\n"
              : "235 Authentication accepted\r\n",
          );
        } else if (line.startsWith("MAIL FROM:")) {
          recipients = [];
          data = [];
          socket.write("250 sender accepted\r\n");
        } else if (line.startsWith("RCPT TO:")) {
          recipients.push(
            line.slice(line.indexOf("<") + 1, line.lastIndexOf(">")),
          );
          socket.write("250 recipient accepted\r\n");
        } else if (line === "DATA") {
          collecting = true;
          socket.write("354 End with dot\r\n");
        } else if (line === "QUIT") socket.end("221 bye\r\n");
        else socket.write("250 ok\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture listener unavailable");
  configuration.SMTP_PORT = address.port;
});
afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("real Nodemailer SMTP transport against loopback-only fixture", () => {
  it("authenticates and sends transactional mail to exactly the supplied recipients", async () => {
    await sendTransactionalEmail(
      ["one@example.invalid", "two@example.invalid"],
      "Fixture subject",
      "Fixture body",
    );
    expect(authentication).toBe(
      `\0${configuration.SMTP_USER}\0${configuration.SMTP_PASSWORD}`,
    );
    expect(messages[0].recipients).toEqual([
      "one@example.invalid",
      "two@example.invalid",
    ]);
    expect(messages[0].data).toContain("Fixture body");
  });
  it("delivers verification URL/token and expiry through actual MIME/SMTP processing", async () => {
    await sendVerificationEmail("verify@example.invalid", "a".repeat(43));
    expect(messages[0].recipients).toEqual(["verify@example.invalid"]);
    expect(messages[0].data).toContain("/verify-email?token=");
    expect(messages[0].data).toContain("24 hours");
  });
  it("keeps inquiry delivery addressed to the company and places the sender in Reply-To", async () => {
    await sendPublicInquiry(
      "Fixture inquiry",
      "Fixture inquiry body",
      "reply@example.invalid",
    );
    expect(messages[0].recipients).toEqual(["sender@example.invalid"]);
    expect(messages[0].data).toContain("Reply-To: reply@example.invalid");
  });
  it("rejects SMTP authentication failure without reporting delivery", async () => {
    rejectAuthentication = true;
    await expect(
      sendVerificationEmail("verify@example.invalid", "b".repeat(43)),
    ).rejects.toMatchObject({ code: "EAUTH" });
    expect(messages).toHaveLength(0);
  });
  it.each([
    [
      "GHSA-8c8m-p3m8-cjg8",
      "Victim (x(y) <evil@evil.com>) <v@victim.com>",
      "v@victim.com",
    ],
    [
      "GHSA-m943-m63m-w62w comment",
      "G: (a; <evil@evil.com>) <v@victim.com>;",
      "v@victim.com",
    ],
    [
      "GHSA-m943-m63m-w62w quoted name",
      'G: "a;" "<evil@evil.com>" <v@victim.com>;',
      "v@victim.com",
    ],
    ["GHSA-85x2-q946-cp5h", '<"a@evil.com>"@good.com>', "@good.com"],
  ])(
    "preserves the intended SMTP envelope for %s",
    async (_id, address, expected) => {
      await sendTransactionalEmail(
        address,
        "Synthetic advisory regression",
        "Captured only on loopback; no external delivery",
      );
      if (expected.startsWith("@")) {
        expect(messages[0].recipients).toHaveLength(1);
        const recipient = messages[0].recipients[0];
        expect(recipient.slice(recipient.lastIndexOf("@"))).toBe(expected);
      } else expect(messages[0].recipients).toEqual([expected]);
    },
  );
});
