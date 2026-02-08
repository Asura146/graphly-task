import { hc } from "hono/client";
import { AppType } from "@/server";

// Next.jsの環境に合わせてベースURLを設定
const client = hc<AppType>(
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
);

export const api = client.api;