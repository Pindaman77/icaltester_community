import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;

  return {
    server: {
      host: "::",
      port: 5173,
      ...(supabaseUrl && {
        proxy: {
          // Proxy /api/feed/* requests to Supabase Functions
          // Transforms /api/feed/{token} -> /functions/v1/ics-feed/{token}
          "/api/feed": {
            target: supabaseUrl,
            changeOrigin: true,
            rewrite: (path) => {
              // Extract token from /api/feed/{token}
              const match = path.match(/^\/api\/feed\/(.+)$/);
              if (match) {
                const token = match[1];
                // Rewrite to Supabase Functions path
                return `/functions/v1/ics-feed/${token}`;
              }
              return path;
            },
            configure: (proxy, _options) => {
              proxy.on("error", (err, _req, _res) => {
                console.log("proxy error", err);
              });
              proxy.on("proxyReq", (proxyReq, req, _res) => {
                console.log("Proxying:", req.url, "->", proxyReq.path);
              });
            },
          },
        },
      }),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
