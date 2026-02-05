// proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth"; 

export async function proxy(request: NextRequest) {
    // 1. ヘッダーを渡して、サーバーサイドでセッションの正当性を検証
    // これにより、期限切れや無効なCookieは null になります
    const session = await auth.api.getSession({
        headers: request.headers
    });

    console.log("Path:", request.nextUrl.pathname);
    console.log("Session exists:", !!session);

    const isAuthPage = request.nextUrl.pathname.startsWith("/login");
    const isProtectedRoute = 
        request.nextUrl.pathname.startsWith("/dashboard") || 
        request.nextUrl.pathname.startsWith("/profile");

    // 2. 保護されたルートかつ、セッションが無効な場合
    if (isProtectedRoute && !session) {
        // ログインページへ飛ばす
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // 3. ログイン済みでログインページに行こうとした場合はダッシュボードへ（任意）
    if (isAuthPage && session) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
}

export const config = {
    // matcherで漏れがないか確認
    matcher: ["/dashboard/:path*", "/profile/:path*", "/login"],
};