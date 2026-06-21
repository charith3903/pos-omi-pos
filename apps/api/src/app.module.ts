import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportsModule } from './reports/reports.module';
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
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: { url: cfg.get('REDIS_URL', 'redis://localhost:6379') },
      }),
    }),
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
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
