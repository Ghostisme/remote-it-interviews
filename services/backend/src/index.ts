import { Hono } from "hono";
const app = new Hono();
app.get("/health", (c) => c.json({ status: "ok", service: "odyssey-api" }));
export default app;
