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
import { PurchasingModule } from './purchasing/purchasing.module';
import { RefundsModule } from './refunds/refunds.module';
import { WarrantyModule } from './warranty/warranty.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { OutletsModule } from './outlets/outlets.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { ShiftsModule } from './shifts/shifts.module';
import { BillingModule } from './billing/billing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PosSettingsModule } from './pos-settings/pos-settings.module';
import { QuotationsModule } from './quotations/quotations.module';
import { HeldSalesModule } from './held-sales/held-sales.module';
import { UsersModule } from './users/users.module';
import { DevicesModule } from './devices/devices.module';
import { RepairsModule } from './repairs/repairs.module';

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
    PurchasingModule,
    RefundsModule,
    WarrantyModule,
    SuppliersModule,
    OutletsModule,
    LoyaltyModule,
    ShiftsModule,
    BillingModule,
    NotificationsModule,
    PosSettingsModule,
    QuotationsModule,
    HeldSalesModule,
    UsersModule,
    DevicesModule,
    RepairsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
