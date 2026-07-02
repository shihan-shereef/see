// Mock Supabase Client for development
export function createClient() {
  return {
    auth: {
      async signInWithOAuth({ provider, options }: any) {
        // Mock setting a cookie for the frontend
        const isProd = window.location.protocol === "https:";
        document.cookie = `mock_supabase_session=mock-token; path=/; ${isProd ? "Secure; SameSite=Lax;" : ""}`;
        
        // Mock successful login redirection
        if (options?.redirectTo) {
          const redirectUrl = new URL(options.redirectTo);
          redirectUrl.searchParams.set("code", "mock-auth-code");
          window.location.href = redirectUrl.toString();
        }
        return { data: {}, error: null };
      },
      async signOut() {
        document.cookie = "mock_supabase_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
        return { error: null };
      }
    }
  };
}
