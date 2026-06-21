import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CustomersModule } from './customers/customers.module';
import { HealthModule } from './health/health.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StockModule } from './stock/stock.module';
import { MobileModule } from './mobile/mobile.module';
import { RentalModule } from './rental/rental.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { SupermarketModule } from './supermarket/supermarket.module';
import { SyncModule } from './sync/sync.module';
import { TenantModule } from './tenant/tenant.module';
import { TextileModule } from './textile/textile.module';
import { VerticalModule } from './vertical/vertical.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    TenantModule,
    AuthModule,
    HealthModule,
    CatalogModule,
    CustomersModule,
    InvoicesModule,
    StockModule,
    SyncModule,
    VerticalModule,
    RestaurantModule,
    MobileModule,
    RentalModule,
    SupermarketModule,
    TextileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
