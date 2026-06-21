import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  providers: [SyncService],
  controllers: [SyncController],
})
export class SyncModule {}
