import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module.js';
import pino from 'pino';
import cors from 'cors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', transport: { target: 'pino-pretty' } });

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const port = Number(process.env.PORT || 3000);
  const origin = process.env.CORS_ORIGIN || 'http://localhost:8080';
  app.use(cors({ origin: [origin, 'http://localhost:5173'], credentials: true }));
  app.useWebSocketAdapter(new WsAdapter(app));
  await app.listen(port);
  logger.info(`Backend listening on http://localhost:${port}`);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
