import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!_next/|favicon.ico|api/health).*)"],
};

export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice("Basic ".length), "base64").toString("utf8");
    const [, supplied] = decoded.split(":", 2);
    if (supplied === password) return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Studio Chrono"' },
  });
}
