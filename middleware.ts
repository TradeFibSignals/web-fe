import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Log all requests to archive pages for debugging
  if (request.nextUrl.pathname.startsWith("/archive/")) {
    console.log(`Archive page requested: ${request.nextUrl.pathname}`)
  }

  return NextResponse.next()
}
