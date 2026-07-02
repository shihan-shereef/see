import { type NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// Try multiple possible locations for db.json
function findDbFile(): string {
  const candidates = [
    path.join(process.cwd(), "db.json"),                  // monorepo root
    path.join(process.cwd(), "apps/app/db.json"),          // from root → apps/app
    path.resolve(__dirname, "../../../../../db.json"),       // relative to route file
    path.resolve(__dirname, "../../../../../../db.json"),    // one more level up
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Default to cwd
  return path.join(process.cwd(), "db.json");
}

function getDb(): { users: any[]; [key: string]: any } {
  try {
    const file = findDbFile();
    console.log("[api/login] Using db file:", file);
    if (!fs.existsSync(file)) {
      console.log("[api/login] db.json not found at:", file);
      return { users: [] };
    }
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("[api/login] Error reading db:", e);
    return { users: [] };
  }
}

export async function POST(req: NextRequest) {
  try {
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

    console.log("[api/login] Attempting login for:", email);

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const db = getDb();
    console.log("[api/login] Users in db:", db.users?.map((u: any) => u.email));

    const user = (db.users || []).find(
      (u: any) =>
        (u.email || "").trim().toLowerCase() === email &&
        u.password === password
    );

    if (!user) {
      console.log("[api/login] User not found or wrong password");
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    console.log("[api/login] Login successful for:", user.email);

    const response = NextResponse.json({ ok: true, email: user.email });
    response.cookies.set("mock_auth", user.email, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
      sameSite: "lax",
    });
    return response;
  } catch (err) {
    console.error("[api/login] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
