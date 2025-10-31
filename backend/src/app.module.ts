import { Module } from '@nestjs/common';
import { FinnhubModule } from './finnhub/finnhub.module.js';
import { PricesModule } from './prices/prices.module.js';
import { WsModule } from './ws/ws.module.js';

@Module({
  imports: [FinnhubModule, PricesModule, WsModule],
})
export class AppModule {}
