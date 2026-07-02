import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/seo";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // In a real app this sets the cookie via SSR, but in our mock we'll just set it manually here too
      // since our server mock is minimal
      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.set("mock_supabase_session", "mock-token", { 
        path: "/",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
      });
      return response;
    } else {
      console.error("Auth callback error:", error);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
