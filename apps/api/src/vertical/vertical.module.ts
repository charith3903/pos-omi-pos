import { Module } from '@nestjs/common';
import { PosSettingsModule } from '../pos-settings/pos-settings.module';
import { VerticalController } from './vertical.controller';
import { VerticalService } from './vertical.service';

@Module({
  imports: [PosSettingsModule],
  providers: [VerticalService],
  controllers: [VerticalController],
  exports: [VerticalService],
})
export class VerticalModule {}
