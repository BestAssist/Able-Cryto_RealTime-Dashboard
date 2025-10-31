import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { WebSocketServer as WSServer } from 'ws';
import pino from 'pino';
import { NormalizedTick } from '../prices/prices.service';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: { target: 'pino-pretty' },
});

@WebSocketGateway({
  path: '/ws',
  cors: { origin: ['http://localhost:8080', 'http://localhost:5173'] },
})
export class WsGateway {
  // use the correct type from ws
  @WebSocketServer()
  server!: InstanceType<typeof WSServer>;

  broadcastPrice(tick: NormalizedTick) {
    const msg = JSON.stringify({ type: 'price', data: tick });
    this.server?.clients?.forEach((client: any) => {
      if (client.readyState === 1) {
        try {
          client.send(msg);
        } catch (err) {
          // Continue broadcasting even if one client fails
          if (process.env.NODE_ENV !== 'test') {
            logger.warn({ err }, 'Failed to send message to client');
          }
        }
      }
    });
  }
}
