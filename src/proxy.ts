import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check session token
  const token = request.cookies.get("session-token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const user = await verifyToken(token);
  if (!user) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("session-token");
    return response;
  }

  // Admin routes protection
  if (pathname.startsWith("/admin") && user.role !== "admin") {
    return NextResponse.redirect(new URL("/client", request.url));
  }

  // Client routes protection - any authenticated user can access /client
  if (pathname.startsWith("/client") && user.role !== "admin" && user.role !== "client") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Add user info to headers for server components
  const response = NextResponse.next();
  response.headers.set("x-user-id", user.id);
  response.headers.set("x-user-email", user.email);
  response.headers.set("x-user-role", user.role);
  response.headers.set("x-user-name", user.name);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
