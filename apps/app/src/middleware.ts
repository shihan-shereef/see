import { createI18nMiddleware } from "next-international/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const I18nMiddleware = createI18nMiddleware({
  locales: ["en", "fr", "es"],
  defaultLocale: "en",
  urlMappingStrategy: "rewrite",
});

// Pages accessible without login
const PUBLIC_PATHS = ["/login", "/signup"];

function isPublicPath(pathname: string): boolean {
  // Strip locale prefix: /en/login → /login
  const p = pathname.replace(/^\/(en|fr|es)(\/|$)/, "/") || "/";
  return PUBLIC_PATHS.some((pub) => p === pub || p.startsWith(pub + "/"));
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip all static assets and API routes entirely, except the auth callback
  if (
    pathname.startsWith("/_next") ||
    (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/callback")) ||
    /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Update Supabase Session
  const { supabaseResponse, user } = await updateSession(request);
  const isLoggedIn = !!user;
  const isPub = isPublicPath(pathname);

  // 3. Handle Redirects
  if (isPub && isLoggedIn) {
    // Already authenticated on a public page → send to SEO dashboard
    const redirectUrl = new URL("/seo", request.url);
    const res = NextResponse.redirect(redirectUrl);
    // Copy cookies from supabaseResponse to the redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value, cookie);
    });
    return res;
  }

  if (!isPub && !isLoggedIn && !pathname.startsWith("/api/auth/callback")) {
    // Not logged in and trying to access protected route → send to login
    const redirectUrl = new URL("/login", request.url);
    const res = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value, cookie);
    });
    return res;
  }

  // 4. Apply i18n mapping if not an API route
  if (!pathname.startsWith("/api/")) {
    const i18nResponse = I18nMiddleware(request);
    // Copy cookies from supabaseResponse to i18nResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      i18nResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return i18nResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Match everything except static files, images, favicons
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
