import { getDb } from "@/lib/localDb";
import { NextResponse } from "next/server";

// Accepts form-encoded POST (from the native form submit in auth-form.tsx)
export async function POST(req: Request) {
  try {
    let email = "";
    let password = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      email = body.email || "";
      password = body.password || "";
    } else {
      // Native HTML form POST sends application/x-www-form-urlencoded
      const formData = await req.formData();
      email = (formData.get("email") as string) || "";
      password = (formData.get("password") as string) || "";
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const db = getDb();
    const user = db.users.find(
      (u) =>
        u.email.toLowerCase() === email.trim().toLowerCase() &&
        u.password === password
    );

    if (!user) {
      // Redirect back to login with error param
      const origin = new URL(req.url).origin;
      return NextResponse.redirect(`${origin}/login?error=invalid`, { status: 302 });
    }

    // Set cookie and redirect to dashboard
    const origin = new URL(req.url).origin;
    const redirectResponse = NextResponse.redirect(`${origin}/`, { status: 302 });
    redirectResponse.cookies.set("mock_auth", user.email, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
      sameSite: "lax",
    });

    return redirectResponse;
  } catch (err) {
    console.error("Signin error:", err);
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(`${origin}/login?error=server`, { status: 302 });
  }
}
