import { Hono } from "hono";
import { authRoute } from "./auth";
import { auth } from "@/lib/auth"
import { taskRoute } from "./tasks";
import { teamRoute } from "./teams";
import { taskGroupRoute } from "./taskGroups"; // 追加
import { userRoute } from "./users"; // インポートを追加

export type Env = {
    Variables: {
      user: typeof auth.$Infer.Session.user | null;
      session: typeof auth.$Infer.Session.session | null;
    };
  };

const app = new Hono<Env>().basePath("/api");
app.use("*", async (c, next) => {
    // c.req.raw.headers を渡すことでCookie内のセッションを解析
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
  
    if (!session) {
      c.set("user", null);
      c.set("session", null);
    } else {
      c.set("user", session.user);
      c.set("session", session.session);
    }
  
    await next();
  });

const routes = app
.route("/auth", authRoute)
.route("/teams", teamRoute)
.route("/tasks", taskRoute)
.route("/task-groups", taskGroupRoute) // 追加
.route("/users", userRoute); // ★追加

export default app;
export type AppType = typeof routes;