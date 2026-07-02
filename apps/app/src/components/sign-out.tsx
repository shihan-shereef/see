"use client";

import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { createClient } from "@/utils/supabase/client";

export function SignOut() {
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
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
