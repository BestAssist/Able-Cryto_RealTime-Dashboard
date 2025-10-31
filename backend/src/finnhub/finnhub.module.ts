import { Module } from '@nestjs/common';
import { FinnhubService } from './finnhub.service';
import { PricesModule } from '../prices/prices.module';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [PricesModule, WsModule],
  providers: [FinnhubService],
})
export class FinnhubModule {}
