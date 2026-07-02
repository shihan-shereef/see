import { cookies } from "next/headers";

// Mock Supabase Server Client for development
export function createClient() {
  const cookieStore = cookies();

  return {
    auth: {
      async getUser() {
        const session = cookieStore.get("mock_supabase_session")?.value;
        if (session) {
          return { data: { user: { id: "mock-user-123", email: "shihanshereef2@gmail.com", name: "Shihan" } }, error: null };
        }
        return { data: { user: null }, error: null };
      },
      async exchangeCodeForSession(code: string) {
        // Mock successful login
        return { data: { session: { access_token: "mock-token" } }, error: null };
      },
      async signOut() {
        // This is a server method, but usually signout happens on client or route handler
      }
    }
  };
}
