import { Module } from '@nestjs/common';
import { VerticalModule } from '../vertical/vertical.module';
import { PurchasingModule } from '../purchasing/purchasing.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [VerticalModule, PurchasingModule],
  providers: [CatalogService],
  controllers: [CatalogController],
  exports: [CatalogService],
})
export class CatalogModule {}
