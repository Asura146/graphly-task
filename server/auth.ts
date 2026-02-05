import { Hono } from "hono";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export const authRoute = new Hono()


    .post("/delete-account", async (c) => {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        
        if (!session) {
            return c.json({ error: "ログインしていません" }, 401);
        }

        // データベースから直接削除
        await db.delete(user).where(eq(user.id, session.user.id));

        return c.json({ message: "削除成功" });
    })
    .on(["POST","GET"],"/*", (c) => auth.handler(c.req.raw));