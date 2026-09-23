import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Browser tests own every API response. Even requests made during teardown
    // must fail locally rather than falling through to the personal backend.
    ...(process.env.PROTOCOL_TEST_API_ONLY === "1"
      ? [
          {
            name: "synthetic-api-only",
            configureServer(server: import("vite").ViteDevServer) {
              server.middlewares.use("/api", (_req, res) => {
                res.statusCode = 501;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Unmocked test API request" }));
              });
            },
          },
        ]
      : []),
  ],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  server: {
    proxy:
      process.env.PROTOCOL_TEST_API_ONLY === "1"
        ? undefined
        : { "/api": "http://localhost:8080" },
  },
});
