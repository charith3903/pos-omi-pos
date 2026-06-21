import { Module } from '@nestjs/common';
import { SupermarketController } from './supermarket.controller';
import { SupermarketService } from './supermarket.service';

@Module({
  providers: [SupermarketService],
  controllers: [SupermarketController],
  exports: [SupermarketService],
})
export class SupermarketModule {}
