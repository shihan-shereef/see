import { getDb, saveDb } from "@/lib/localDb";
import { NextResponse } from "next/server";

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
      const formData = await req.formData();
      email = (formData.get("email") as string) || "";
      password = (formData.get("password") as string) || "";
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // User was already created by the /check-new endpoint; just set the cookie
    const db = getDb();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (!user) {
      const origin = new URL(req.url).origin;
      return NextResponse.redirect(`${origin}/login?error=invalid`, { status: 302 });
    }

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
    console.error("Signup error:", err);
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(`${origin}/login?error=server`, { status: 302 });
  }
}
