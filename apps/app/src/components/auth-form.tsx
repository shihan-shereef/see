"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { useState } from "react";

type Mode = "signIn" | "signUp";

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function AuthForm() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("shihanshereef2@gmail.com");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (flow: Mode) => async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signIn("password", { email, password, flow });
    } catch (err: any) {
      setError(err?.message || "Invalid email or password");
    } finally {
      setPending(false);
    }
  };

  const handleGoogle = async () => {
    setPending(true);
    setError(null);
    try {
      await signIn("google");
    } catch (err: any) {
      setError("Failed to sign in with Google");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <form
        className="flex w-72 flex-col gap-3"
        onSubmit={handle(mode)}
        suppressHydrationWarning
      >
        <input
          className={inputCls}
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          suppressHydrationWarning
        />
        <input
          className={inputCls}
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          suppressHydrationWarning
        />
        <Button type="submit" disabled={pending} className="font-mono" suppressHydrationWarning>
          {pending ? "…" : mode === "signIn" ? "Sign in" : "Create account"}
        </Button>
        {error && <p className="text-xs text-red-500" suppressHydrationWarning>{error}</p>}
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
