import { Server } from 'socket.io';
import { socketBus, TRAIN_PROGRESS_EVENT, PREDICTION_CREATED_EVENT, PREDICTION_UPDATED_EVENT, TRADE_CREATED_EVENT } from '@/lib/socket-bus';

export const setupSocket = (io: Server) => {
  // Relay training progress to all clients
  socketBus.on(TRAIN_PROGRESS_EVENT, (payload) => {
    io.emit('TRAIN_PROGRESS_EVENT', payload);
  });

  // Relay prediction and trade events to all clients
  socketBus.on(PREDICTION_CREATED_EVENT, (payload) => {
    io.emit('PREDICTION_CREATED_EVENT', payload);
  });
  socketBus.on(PREDICTION_UPDATED_EVENT, (payload) => {
    io.emit('PREDICTION_UPDATED_EVENT', payload);
  });
  socketBus.on(TRADE_CREATED_EVENT, (payload) => {
    io.emit('TRADE_CREATED_EVENT', payload);
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle messages
    socket.on('message', (msg: { text: string; senderId: string }) => {
      // Echo back to the sender
      socket.emit('message', {
        text: `Echo: ${msg.text}`,
        senderId: 'system',
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    // Optional welcome
    socket.emit('message', {
      text: 'Welcome to WebSocket Server!',
      senderId: 'system',
      timestamp: new Date().toISOString(),
    });
  });

  io.engine.on('connection_close', () => {
    // No-op; relying on process restart to reset listeners
  });
};