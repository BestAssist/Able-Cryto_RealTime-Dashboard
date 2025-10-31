import { Module } from '@nestjs/common';
import { FinnhubService } from './finnhub.service.js';
import { PricesModule } from '../prices/prices.module.js';
import { WsModule } from '../ws/ws.module.js';

@Module({
  imports: [PricesModule, WsModule],
  providers: [FinnhubService],
})
export class FinnhubModule {}
