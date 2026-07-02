import { createI18nMiddleware } from "next-international/middleware";
import { type NextRequest, NextResponse } from "next/server";

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

  // 1. Skip all static assets and API routes entirely
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    const mockAuth = request.cookies.get("mock_auth")?.value;
    const isLoggedIn = !!mockAuth;
    const isPub = isPublicPath(pathname);

    if (isPub && isLoggedIn) {
      // Already authenticated → send to SEO dashboard
      return NextResponse.redirect(new URL("/seo", request.url));
    }

    if (!isPub && !isLoggedIn) {
      // Not logged in → send to login
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Authenticated on a normal page OR on public page without auth → i18n rewrite
    return I18nMiddleware(request);
  }

  // ── Production: delegate to Convex Auth ──────────────────────────────
  const {
    convexAuthNextjsMiddleware,
    createRouteMatcher,
    nextjsMiddlewareRedirect,
  } = await import("@convex-dev/auth/nextjs/server");

  const isSignInPage = createRouteMatcher(["/login", "/:locale/login"]);

  return convexAuthNextjsMiddleware(async (req, { convexAuth }) => {
    const isAuthenticated = await convexAuth.isAuthenticated();
    const isSignIn = isSignInPage(req);
    if (isSignIn && isAuthenticated) return nextjsMiddlewareRedirect(req, "/seo");
    if (!isSignIn && !isAuthenticated) return nextjsMiddlewareRedirect(req, "/login");
    return I18nMiddleware(req);
  })(request, {} as any);
}

export const config = {
  matcher: [
    // Match everything except static files, images, favicons
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
