import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const session = request.cookies.get("mock_supabase_session")?.value;
  
  // Return mock user if session cookie exists
  const user = session ? { id: "mock-user-123", email: "shihanshereef2@gmail.com", name: "Shihan" } : null;

  return { supabaseResponse, user };
}
