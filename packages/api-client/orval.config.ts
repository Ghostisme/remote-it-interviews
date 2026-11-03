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
      clean: true,
      override: {
        mutator: { path: "src/http.ts", name: "apiRequest" },
        query: { signal: true },
      },
    },
  },
});
