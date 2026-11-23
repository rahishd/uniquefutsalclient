import type { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { JwtUtil } from "../../utils/jwt";
import { isAccountActive } from "../../middlewares/auth.middleware";
import logger from "../../config/logger";

// Real-time channel for Unique Ludo: a WebSocket at /api/ludo/ws.
//
// The socket is only a one-way "something changed" line from the server (plus a heartbeat). Everything a player DOES goes
// through the normal signed-in REST routes, which check the rules; nothing sent over the socket can move a token or roll a die.
// The first message must be {type:"auth", token} with the same access token the app uses (never in the URL, so it is not logged).
// "Online" means: this person has the Unique Ludo pages open right now (a live socket). This is held in this server
// process; with more than one API process, a shared pub/sub (for example Redis) is needed (see docs/API.md).

const conns = new Map<string, Set<WebSocket>>();
type Hook = (userId: string) => void;
let onFirstConnect: Hook = () => undefined;
let onLastDisconnect: Hook = () => undefined;

export const isOnline = (userId: string) => (conns.get(userId)?.size ?? 0) > 0;
export const onlineCount = () => conns.size;

export function sendTo(userId: string, msg: unknown) {
  const set = conns.get(userId);
  if (!set) return;
  const text = JSON.stringify(msg);
  for (const ws of set) if (ws.readyState === WebSocket.OPEN) ws.send(text);
}

export function setPresenceHooks(connect: Hook, disconnect: Hook) {
  onFirstConnect = connect;
  onLastDisconnect = disconnect;
}

const ALIVE = new WeakMap<WebSocket, boolean>();

export function attachLudoSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = (req.url ?? "").split("?")[0];
    if (url !== "/api/ludo/ws") return; // other upgrade requests are not ours
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws) => {
    let userId: string | null = null;
    ALIVE.set(ws, true);
    const authTimer = setTimeout(() => { if (!userId) ws.close(4401, "auth"); }, 5000);

    ws.on("pong", () => ALIVE.set(ws, true));
    ws.on("message", async (raw) => {
      let msg: { type?: string; token?: string };
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type === "ping") return void ws.send('{"type":"pong"}');
      if (msg.type !== "auth" || userId || typeof msg.token !== "string") return;
      try {
        const who = JwtUtil.verify(msg.token);
        if (!(await isAccountActive(who.id))) return void ws.close(4403, "suspended");
        userId = who.id;
        clearTimeout(authTimer);
        let set = conns.get(userId);
        const first = !set || set.size === 0;
        if (!set) conns.set(userId, (set = new Set()));
        set.add(ws);
        ws.send(JSON.stringify({ type: "ready" }));
        if (first) onFirstConnect(userId);
      } catch {
        ws.close(4401, "auth");
      }
    });
    ws.on("close", () => {
      clearTimeout(authTimer);
      if (!userId) return;
      const set = conns.get(userId);
      set?.delete(ws);
      if (set && set.size === 0) {
        conns.delete(userId);
        onLastDisconnect(userId);
      }
    });
    ws.on("error", (e) => logger.warn(`ludo socket error: ${e.message}`));
  });

  // heartbeat: a socket that did not answer the last ping is dead (phone lost signal), so the player counts as offline
  const beat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ALIVE.get(ws) === false) { ws.terminate(); continue; }
      ALIVE.set(ws, false);
      try { ws.ping(); } catch { /* closing */ }
    }
  }, 15000);
  beat.unref();
  return wss;
}
