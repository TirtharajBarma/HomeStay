import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function verifyJwt(token: string, secret: string | undefined): Promise<any> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode payload
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);

    // Cryptographically verify HMAC-SHA256 signature using Web Crypto API
    if (secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      const binarySig = atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/"));
      const sigBytes = new Uint8Array(binarySig.length);
      for (let i = 0; i < binarySig.length; i++) {
        sigBytes[i] = binarySig.charCodeAt(i);
      }

      const dataBytes = encoder.encode(`${headerB64}.${payloadB64}`);
      const valid = await crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
      if (!valid) return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("platform_admin_token")?.value;
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === "/login";

  let isValid = false;
  if (token) {
    const secret = process.env.JWT_SECRET;
    const payload = await verifyJwt(token, secret);
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
