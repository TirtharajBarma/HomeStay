import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function parseJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get("platform_admin_token")?.value;
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === "/login";

  let isValid = false;
  if (token) {
    const payload = parseJwtPayload(token);
    const nowSec = Math.floor(Date.now() / 1000);
    const notExpired = payload?.exp ? payload.exp > nowSec : false;
    const isAdmin = payload?.role === "admin";
    isValid = Boolean(notExpired && isAdmin);
  }

  if (!isValid && !isLoginPage) {
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    // Hardening: Clear any forged or expired token cookie
    if (token) {
      response.cookies.delete("platform_admin_token");
    }
    return response;
  }

  if (isValid && isLoginPage) {
    const dashboardUrl = new URL("/", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icons, manifest
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
