import { getDb } from "@/lib/localDb";
import { NextResponse } from "next/server";

// JSON-only endpoint to validate credentials before the native form POST
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
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
      return NextResponse.json(
        { error: "Invalid email or password. Please check your credentials." },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
