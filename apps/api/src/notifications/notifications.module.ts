import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { WhatsappAdapter } from './adapters/whatsapp.adapter';
import { SmsAdapter } from './adapters/sms.adapter';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, WhatsappAdapter, SmsAdapter],
  exports: [NotificationsService],
})
export class NotificationsModule {}
