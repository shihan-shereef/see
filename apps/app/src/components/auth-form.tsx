"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { useState } from "react";
import { toast } from "sonner";

type Mode = "signIn" | "signUp";

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

const isDev = process.env.NODE_ENV === "development";

async function localLogin(email: string, password: string): Promise<void> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
    credentials: "same-origin",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Invalid email or password");
  }

  // Cookie is set via the response header (Set-Cookie: mock_auth=...)
  // Force a hard navigation to /seo so the middleware sees the cookie on the next request
  window.location.href = "/seo";
}

async function localSignup(email: string, password: string): Promise<void> {
  // Read current db, create user, then login
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password, action: "signup" }),
    credentials: "same-origin",
  });

  if (res.status === 404 || !res.ok) {
    // Try registering first
    const signupRes = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
      credentials: "same-origin",
    });
    if (!signupRes.ok) {
      const d = await signupRes.json().catch(() => ({}));
      throw new Error(d.error || "Registration failed");
    }
    window.location.href = "/seo";
    return;
  }

  window.location.href = "/seo";
}

export function AuthForm() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("shihanshereef2@gmail.com");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (fn: () => Promise<void>) => async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await fn();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setPending(false);
    }
  };

  const submitSignIn = handle(async () => {
    if (isDev) {
      await localLogin(email, password);
      return;
    }
    await signIn("password", { email, password, flow: "signIn" });
  });

  const submitSignUp = handle(async () => {
    if (isDev) {
      await localSignup(email, password);
      return;
    }
    await signIn("password", { email, password, flow: "signUp" });
  });

  const handleGoogle = async () => {
    if (isDev) {
      // Google sign-in in dev = log in with the registered gmail account
      try {
        setPending(true);
        await localLogin("shihanshereef2@gmail.com", "Shi@2004");
      } catch (err: any) {
        setError(err?.message || "Google sign-in failed");
        setPending(false);
      }
      return;
    }
    await signIn("google");
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <form
        className="flex w-72 flex-col gap-3"
        onSubmit={mode === "signIn" ? submitSignIn : submitSignUp}
      >
        <input
          className={inputCls}
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          className={inputCls}
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
        />
        <Button type="submit" disabled={pending} className="font-mono">
          {pending ? "…" : mode === "signIn" ? "Sign in" : "Create account"}
        </Button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </form>

      <div className="flex w-72 justify-between">
        {mode === "signIn" ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => { setError(null); setMode("signUp"); }}
          >
            Create account
          </button>
        ) : (
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => { setError(null); setMode("signIn"); }}
          >
            Have an account? Sign in
          </button>
        )}
      </div>

      <div className="flex w-72 items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="outline"
        className="w-72 font-mono"
        disabled={pending}
        onClick={handleGoogle}
      >
        Continue with Google
      </Button>
    </div>
  );
}
