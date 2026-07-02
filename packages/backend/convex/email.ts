"use node";

import { v } from "convex/values";
import nodemailer from "nodemailer";
import { internalAction } from "./_generated/server";

/**
 * SMTP sender (Node action). Auth providers dispatch here; if SMTP_HOST is unset it's a
 * no-op (providers still log the code, so dev/log-fallback keeps working).
 * Local inbox: point SMTP_HOST/SMTP_PORT at Mailpit (default :1025).
 */
export const sendEmail = internalAction({
  args: { to: v.string(), subject: v.string(), text: v.string() },
  handler: async (_ctx, { to, subject, text }) => {
    const host = process.env.SMTP_HOST;
    if (!host) return;
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? "1025"),
      secure: false,
      ...(process.env.SMTP_USER
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } }
        : {}),
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? "auth@myos.local",
      to,
      subject,
      text,
    });
  },
});
