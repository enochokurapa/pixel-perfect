// @lovable.dev/vite-tanstack-config already includes TanStack Start, React,
// Tailwind, tsconfig paths and the development tooling used by this project.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Coolify runs Visitor Flow as a long-lived Node.js container rather than
  // a Cloudflare Worker, so emit Nitro's Node server bundle.
  nitro: {
    preset: "node-server",
  },
  tanstackStart: {
    // Keep the project's branded SSR error wrapper as the server entry.
    server: { entry: "server" },
  },
});
