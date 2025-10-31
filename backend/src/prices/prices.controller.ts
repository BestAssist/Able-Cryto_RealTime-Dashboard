import { Controller, Get, Query } from '@nestjs/common';
import { PricesService, PairKey } from './prices.service';

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
    const hrsNum = Number(hours || 24);
    const hrs = isNaN(hrsNum) ? 24 : Math.max(1, Math.min(720, hrsNum));
    return this.svc.hourlyHistory(pair, hrs);
  }
}
