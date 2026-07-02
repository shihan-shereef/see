import { type NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const DB_FILE = path.join(process.cwd(), "db.json");

function getDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { users: [], workspaces: [], members: [], apiKeys: [], jobs: [], audits: [] };
    }
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch {
    return { users: [], workspaces: [], members: [], apiKeys: [], jobs: [], audits: [] };
  }
}

function saveDb(db: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const db = getDb();
    const exists = (db.users || []).some(
      (u: any) => (u.email || "").toLowerCase() === email.trim().toLowerCase()
    );

    if (exists) {
      return NextResponse.json(
        { error: "Account already exists. Please sign in." },
        { status: 400 }
      );
    }

    const newUser = {
      email: email.trim().toLowerCase(),
      password,
      name: email.split("@")[0],
      avatarUrl: "",
    };

    db.users.push(newUser);
    if (!db.members) db.members = [];
    db.members.push({
      _id: "mem_" + Date.now(),
      workspaceId: "dev-workspace",
      email: newUser.email,
      name: newUser.name,
      role: "member",
    });
    if (!db.audits) db.audits = [];
    db.audits.unshift({
      _id: "act_" + Date.now(),
      action: `Account created: ${newUser.email}`,
      at: Date.now(),
    });

    saveDb(db);

    const response = NextResponse.json({ ok: true, email: newUser.email });
    response.cookies.set("mock_auth", newUser.email, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
      sameSite: "lax",
    });
    return response;
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
