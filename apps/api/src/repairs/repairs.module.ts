import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { StockModule } from '../stock/stock.module';
import { RepairsController } from './repairs.controller';
import { RepairsService } from './repairs.service';

@Module({
  imports: [InvoicesModule, StockModule],
  controllers: [RepairsController],
  providers: [RepairsService],
})
export class RepairsModule {}
