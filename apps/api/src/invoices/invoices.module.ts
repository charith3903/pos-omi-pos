import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  providers: [InvoicesService],
  controllers: [InvoicesController],
})
export class InvoicesModule {}
