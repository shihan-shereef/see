import { Email } from "@convex-dev/auth/providers/Email";
import { internal } from "./_generated/api";

/**
 * Magic email OTP provider (passwordless). The code is logged (dev fallback) AND, when
 * SMTP is configured, emailed via the Node SMTP action (e.g. local Mailpit inbox).
 */
export const ResendOTP = Email({
  id: "resend-otp",
  apiKey: process.env.RESEND_API_KEY,
  maxAge: 60 * 15, // code valid for 15 minutes
  async generateVerificationToken() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => (b % 10).toString()).join("");
  },
  async sendVerificationRequest(
    { identifier: email, token }: { identifier: string; token: string },
    ctx?: { runAction: (ref: unknown, args: unknown) => Promise<unknown> },
  ) {
    console.warn(`[auth] OTP for ${email}: ${token}`); // dev fallback (docker logs)
    try {
      await ctx?.runAction(internal.email.sendEmail, {
        to: email,
        subject: "Your sign-in code",
        text: `Your sign-in code is ${token}`,
      });
    } catch (e) {
      console.warn(`[email] OTP send failed: ${(e as Error).message}`);
    }
  },
});
