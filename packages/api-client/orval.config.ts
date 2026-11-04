/** Generate API models and React Query hooks from the exported backend OpenAPI contract. */
import { defineConfig } from "orval";
export default defineConfig({
  odyssey: {
    input: "../../services/backend/openapi.json",
    output: {
      target: "src/generated/odyssey.ts",
      schemas: "src/generated/model",
      client: "react-query",
      httpClient: "axios",
      mode: "single",
      // Remove stale models when a contract changes instead of retaining obsolete API shapes.
      clean: true,
      override: {
        mutator: { path: "src/http.ts", name: "apiRequest" },
        query: { signal: true },
      },
    },
  },
});
