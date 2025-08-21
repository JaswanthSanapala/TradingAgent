"use client";
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
export function getSocket(): Socket {
  if (!socket) {
    const path = process.env.NEXT_PUBLIC_SOCKET_PATH || '/api/socketio';
    socket = io(undefined as any, { path });
  }
  return socket;
}
