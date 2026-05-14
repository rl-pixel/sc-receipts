import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!_next/|favicon.ico|api/health).*)"],
};

export function proxy(request: NextRequest) {
  // Machine-to-machine ingest path: if the request carries a valid
  // X-Ingest-Key header, bypass the human basic-auth gate. The route handler
  // (lib/auth.ts requireIngestKey) is responsible for final validation.
  const ingestExpected = process.env.INGEST_API_KEY;
  if (ingestExpected) {
    const supplied = request.headers.get("x-ingest-key");
    if (supplied && supplied === ingestExpected) {
      return NextResponse.next();
    }
  }

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
