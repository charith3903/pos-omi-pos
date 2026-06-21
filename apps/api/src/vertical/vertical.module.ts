import { Module } from '@nestjs/common';
import { VerticalController } from './vertical.controller';
import { VerticalService } from './vertical.service';

@Module({
  providers: [VerticalService],
  controllers: [VerticalController],
  exports: [VerticalService],
})
export class VerticalModule {}
