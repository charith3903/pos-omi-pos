import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { StockModule } from '../stock/stock.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [NotificationsModule, StockModule],
  providers: [InvoicesService],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}
