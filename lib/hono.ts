import { hc } from "hono/client";
import { AppType } from "@/server";

// ブラウザ環境では相対パスを使用して現在のオリジンを利用する
// サーバーサイドレンダリング時のみ環境変数やlocalhostを使用する
const baseUrl = typeof window !== 'undefined' 
  ? '' 
  : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

const client = hc<AppType>(baseUrl);

export const api = client.api;