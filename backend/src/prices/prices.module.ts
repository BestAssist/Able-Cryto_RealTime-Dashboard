import { Module } from '@nestjs/common';
import { PricesService } from './prices.service.js';
import { PricesController } from './prices.controller.js';

@Module({
  providers: [PricesService],
  controllers: [PricesController],
  exports: [PricesService],
})
export class PricesModule {}
