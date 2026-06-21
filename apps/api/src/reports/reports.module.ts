import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AggregateDailySalesProcessor } from './jobs/aggregate-daily-sales.processor';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'aggregate-daily-sales' }),
  ],
  providers: [ReportsService, AggregateDailySalesProcessor],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
