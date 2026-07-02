import { type NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const DB_FILE = path.join(process.cwd(), "db.json");

function getUsers(): Array<{ email: string; password: string; name: string }> {
  try {
    if (!fs.existsSync(DB_FILE)) return [];
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const db = JSON.parse(raw);
    return db.users || [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    // Support both JSON and form-encoded bodies
    let email = "";
    let password = "";
    const ct = req.headers.get("content-type") || "";

    if (ct.includes("application/json")) {
      const body = await req.json();
      email = (body.email || "").trim().toLowerCase();
      password = body.password || "";
    } else {
      const form = await req.formData();
      email = ((form.get("email") as string) || "").trim().toLowerCase();
      password = (form.get("password") as string) || "";
    }

    const users = getUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === email && u.password === password
    );

    if (!user) {
      // Redirect back to login with error
      const url = new URL("/login?error=invalid", req.url);
      return NextResponse.redirect(url, { status: 302 });
    }

    // SUCCESS: set cookie and redirect to dashboard
    const url = new URL("/", req.url);
    const res = NextResponse.redirect(url, { status: 302 });
    res.cookies.set("mock_auth", user.email, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false, // needs to be readable by Edge middleware
      sameSite: "lax",
      secure: false,
    });
    return res;
  } catch (err) {
    console.error("Login error:", err);
    const url = new URL("/login?error=server", req.url);
    return NextResponse.redirect(url, { status: 302 });
  }
}
