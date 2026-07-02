import { type NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  // Clear the mock_auth cookie
  res.cookies.set("mock_auth", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: false,
    sameSite: "lax",
  });
  return res;
}

export async function GET(req: NextRequest) {
  // Allow GET logout too (for simple link clicks)
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set("mock_auth", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: false,
    sameSite: "lax",
  });
  return res;
}
