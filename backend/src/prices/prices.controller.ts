import { Controller, Get, Query } from '@nestjs/common';
import { PricesService, PairKey } from './prices.service.js';

@Controller('api')
export class PricesController {
  constructor(private svc: PricesService) {}

  @Get('health')
  async health() {
    return this.svc.health();
  }

  @Get('pairs')
  async pairs() {
    return this.svc.listPairs();
  }

  @Get('averages')
  async averages(@Query('pair') pair: PairKey, @Query('hours') hours?: string) {
    const hrs = Math.max(1, Math.min(720, Number(hours || 24)));
    return this.svc.hourlyHistory(pair, hrs);
  }
}
