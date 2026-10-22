import type { AddressInfo } from "node:net";
import { io as ioClient, type Socket } from "socket.io-client";
import type { ClientToServerEvents, RoomState, ServerToClientEvents } from "@guessdrawing/shared";
import { createGameServer, type GameServerOptions } from "../src/server.js";

export type TestClient = Socket<ServerToClientEvents, ClientToServerEvents> & {
  states: RoomState[];
  lastState: () => RoomState | undefined;
};

export async function startServer(opts: GameServerOptions = {}) {
  const server = createGameServer(opts);
  await new Promise<void>((r) => server.http.listen(0, r));
  const port = (server.http.address() as AddressInfo).port;
  const clients: TestClient[] = [];

  function connect(): Promise<TestClient> {
    const socket = ioClient(`http://localhost:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    }) as TestClient;
    socket.states = [];
    socket.lastState = () => socket.states.at(-1);
    socket.on("room:state", (s) => socket.states.push(s));
    clients.push(socket);
    return new Promise((resolve) => socket.on("connect", () => resolve(socket)));
  }

  async function close() {
    for (const c of clients) c.disconnect();
    server.io.close();
    await new Promise((r) => setTimeout(r, 20));
  }

  return { ...server, port, connect, close };
}

export function join(client: TestClient, name: string, token: string, code?: string) {
  return client.emitWithAck("room:join", { name, sessionToken: token, code });
}

export function waitFor<T>(fn: () => T | undefined | false, timeout = 2000): Promise<T> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const v = fn();
      if (v) return resolve(v);
      if (Date.now() - start > timeout) return reject(new Error("waitFor timed out"));
      setTimeout(tick, 5);
    };
    tick();
  });
}
