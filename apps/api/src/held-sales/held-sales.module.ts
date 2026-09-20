import { Module } from '@nestjs/common';
import { HeldSalesController } from './held-sales.controller';
import { HeldSalesService } from './held-sales.service';

@Module({
  controllers: [HeldSalesController],
  providers: [HeldSalesService],
})
export class HeldSalesModule {}
