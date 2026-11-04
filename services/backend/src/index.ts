/** Cloudflare Worker entry point; route composition also supports database injection in tests. */
import { createApp } from "./app";
export default createApp();
