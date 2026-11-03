import { writeFileSync } from "node:fs";
import { createApp } from "../src/app";

const document = createApp().getOpenAPIDocument({
  openapi: "3.0.3",
  info: {
    title: "Odyssey Restaurant API",
    version: "1.0.0",
    description:
      "Schema-derived API contracts. Money in cents, tax in basis points. Reporting uses UTC.",
  },
});
writeFileSync(
  new URL("../openapi.json", import.meta.url),
  `${JSON.stringify(document, null, 2)}\n`,
);
console.log(`Generated OpenAPI: ${Object.keys(document.paths ?? {}).length} paths.`);
