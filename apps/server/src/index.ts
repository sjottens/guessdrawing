import { createGameServer } from "./server.js";

const port = Number(process.env.PORT ?? 4000);
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : "*";

const { http } = createGameServer({ corsOrigin });

http.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port} (CORS: ${JSON.stringify(corsOrigin)})`);
});
