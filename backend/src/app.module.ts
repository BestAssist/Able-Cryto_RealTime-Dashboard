import { Module } from '@nestjs/common';
import { FinnhubModule } from './finnhub/finnhub.module';
import { PricesModule } from './prices/prices.module';
import { WsModule } from './ws/ws.module';

@Module({
  imports: [FinnhubModule, PricesModule, WsModule],
})
export class AppModule {}
