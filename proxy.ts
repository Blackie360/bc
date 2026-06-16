import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionCookie } from "@/lib/auth/session";

const DISPLAY_NAME_HEADER = "x-bc-user-display-name";
const EMAIL_HEADER = "x-bc-user-email";
const ROLE_HEADER = "x-bc-user-role";
const USERNAME_HEADER = "x-bc-user-username";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/roles" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySessionCookie(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/roles", request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);

    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(DISPLAY_NAME_HEADER, session.displayName);
  if (session.email) {
    requestHeaders.set(EMAIL_HEADER, session.email);
  }
  requestHeaders.set(ROLE_HEADER, session.role);
  requestHeaders.set(USERNAME_HEADER, session.username);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
