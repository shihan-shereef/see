"use client";

import { Button } from "@v1/ui/button";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Mode = "signIn" | "signUp";

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("shihanshereef2@gmail.com");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    
    // Using mock auth behavior for the email flow too
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google", // we mock it using the same method for now
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      console.error(error);
      setError(error.message);
      setPending(false);
    }
  };

  const handleGoogle = async () => {
    setPending(true);
    setError(null);
    const supabase = createClient();
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      console.error(error);
      setError(error.message);
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <form
        className="flex w-72 flex-col gap-3"
        onSubmit={handleCredentials}
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
