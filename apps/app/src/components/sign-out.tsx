"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";

const isDev = process.env.NODE_ENV === "development";

export function SignOut() {
  const { signOut } = useAuthActions();

  const handleSignOut = async () => {
    if (isDev) {
      // Clear the mock_auth cookie and redirect to login
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
      window.location.href = "/login";
      return;
    }
    await signOut();
  };

  return (
    <Button
      onClick={handleSignOut}
      variant="outline"
      className="font-mono gap-2 flex items-center"
    >
      <Icons.SignOut className="size-4" />
      <span>Sign out</span>
    </Button>
  );
}
