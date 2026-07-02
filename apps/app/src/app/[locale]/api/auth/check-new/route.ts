import { getDb, saveDb } from "@/lib/localDb";
import { NextResponse } from "next/server";

// JSON-only endpoint to validate new user before the native form POST
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const db = getDb();
    const exists = db.users.some(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (exists) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in instead." },
        { status: 400 }
      );
    }

    // Pre-create the user here so the form POST can just set the cookie and redirect
    const newUser = {
      email: email.trim().toLowerCase(),
      password,
      name: email.split("@")[0],
      avatarUrl: "",
    };
    db.users.push(newUser);
    db.members.push({
      _id: "mem_" + Date.now(),
      workspaceId: "dev-workspace",
      email: newUser.email,
      role: "member",
    });
    db.audits.unshift({
      _id: "act_" + Date.now(),
      action: `Account registered: ${newUser.email}`,
      at: Date.now(),
    });
    saveDb(db);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Registration check failed" }, { status: 500 });
  }
}
