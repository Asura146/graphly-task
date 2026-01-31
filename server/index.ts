import { Hono } from "hono";
import { authRoute } from "./auth";

const app = new Hono().basePath("/api");

const routes = app.route("/auth", authRoute);

export default app;
export type AppType = typeof routes;