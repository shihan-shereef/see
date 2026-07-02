"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { useState } from "react";

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring";

export function EmailOtpSignin() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (step === "signIn") {
    return (
      <form
        className="flex flex-col gap-3 w-64"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          setPending(true);
          const isOffline = process.env.NODE_ENV === "development";
          if (isOffline) {
            await new Promise((r) => setTimeout(r, 600));
            setStep({ email: fd.get("email") as string });
            setPending(false);
            return;
          }
          void signIn("resend-otp", fd)
            .then(() => setStep({ email: fd.get("email") as string }))
            .catch(() => setError("Could not send code. Try again."))
            .finally(() => setPending(false));
        }}
      >
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className={inputCls}
        />
        <Button type="submit" variant="outline" className="font-mono" disabled={pending}>
          {pending ? "Sending…" : "Send code"}
        </Button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 w-64"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        setPending(true);
        const isOffline = process.env.NODE_ENV === "development";
        if (isOffline) {
          await new Promise((r) => setTimeout(r, 600));
          document.cookie = "mock_auth=true; path=/";
          window.location.href = "/";
          return;
        }
        void signIn("resend-otp", fd)
          .catch(() => setError("Invalid or expired code."))
          .finally(() => setPending(false));
      }}
    >
      <p className="text-xs text-muted-foreground">
        Code sent to <span className="font-mono">{step.email}</span>
      </p>
      <input
        name="code"
        type="text"
        inputMode="numeric"
        required
        placeholder="8-digit code"
        className={inputCls}
      />
      <input name="email" value={step.email} type="hidden" />
      <Button type="submit" className="font-mono" disabled={pending}>
        {pending ? "Verifying…" : "Continue"}
      </Button>
      <button
        type="button"
        className="text-xs text-muted-foreground underline"
        onClick={() => setStep("signIn")}
      >
        Use a different email
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}
