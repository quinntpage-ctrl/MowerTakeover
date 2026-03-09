import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GameRoom } from "./game/GameRoom";
import type { ClientMessage } from "../shared/game/Protocol";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const gameRoom = new GameRoom();
  gameRoom.start();

  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      ok: true,
      players: gameRoom.getPlayerCount(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const playerMap = new Map<WebSocket, string>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    ws.on('message', (rawData: Buffer | string) => {
      try {
        const msg: ClientMessage = JSON.parse(rawData.toString());

        if (msg.type === 'join') {
          const playerId = gameRoom.addPlayer(ws, msg.name, msg.color, msg.trailType);
          playerMap.set(ws, playerId);
          console.log(`Player ${msg.name} joined as ${playerId}`);
        } else {
          const playerId = playerMap.get(ws);
          if (playerId) {
            gameRoom.handleMessage(playerId, msg);
          }
        }
      } catch (e) {
        console.error('Invalid WebSocket message:', e);
      }
    });

    ws.on('close', () => {
      const playerId = playerMap.get(ws);
      if (playerId) {
        console.log(`Player ${playerId} disconnected`);
        gameRoom.removePlayer(playerId);
        playerMap.delete(ws);
      }
    });

    ws.on('error', (err: Error) => {
      console.error('WebSocket error:', err);
      const playerId = playerMap.get(ws);
      if (playerId) {
        gameRoom.removePlayer(playerId);
        playerMap.delete(ws);
      }
    });
  });

  return httpServer;
}
