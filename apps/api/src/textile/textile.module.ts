import { Module } from '@nestjs/common';
import { TextileController } from './textile.controller';
import { TextileService } from './textile.service';

@Module({
  providers: [TextileService],
  controllers: [TextileController],
  exports: [TextileService],
})
export class TextileModule {}
