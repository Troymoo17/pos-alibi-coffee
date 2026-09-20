import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase-middleware";

// Halaman yang boleh diakses tanpa login sama sekali
const PUBLIC_PATHS = ["/login"];
// Prefix path yang boleh diakses tanpa login:
// - /order       -> self-service, diakses pelanggan lewat scan barcode
// - /api         -> API routes (generate QRIS, webhook DOKU) -- ini dipanggil
//                   dari halaman publik /order ATAU langsung dari server DOKU,
//                   keduanya tidak punya sesi login sama sekali
const PUBLIC_PREFIXES = ["/order", "/api"];

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export async function proxy(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { pathname } = request.nextUrl;

  // Path self-service publik -- lewati semua pengecekan login sama sekali
  if (isPublicPath(pathname)) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belum login -> paksa ke halaman login
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Sudah login tapi masih coba buka /login -> lempar ke halaman sesuai role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? null;

  if (pathname === "/login") {
    const target = role === "kasir" ? "/kasir" : "/";
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Kasir cuma boleh akses halaman di bawah /kasir (termasuk /kasir/tutup-kasir)
  if (role === "kasir" && !pathname.startsWith("/kasir")) {
    return NextResponse.redirect(new URL("/kasir", request.url));
  }

  // Admin tidak perlu halaman kasir -- lempar ke dashboard HPP
  if (role === "admin" && pathname.startsWith("/kasir")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Terapkan middleware ke semua path KECUALI:
     * - file statis Next.js (_next/static, _next/image)
     * - favicon
     * - file dengan ekstensi (gambar, dll)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
