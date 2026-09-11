import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [StockModule],
  providers: [SyncService],
  controllers: [SyncController],
})
export class SyncModule {}
