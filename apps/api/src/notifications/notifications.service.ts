import { BadRequestException, Injectable } from '@nestjs/common';
import { MessageChannel, NotificationSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret, maskSecret } from '../common/crypto.util';
import { WhatsappAdapter } from './adapters/whatsapp.adapter';
import { SmsAdapter } from './adapters/sms.adapter';
import { UpdateNotificationSettingsDto } from './dto/update-settings.dto';
import { SendMessageDto } from './dto/send-message.dto';

const MASKED_PREFIX = '•'.repeat(8);

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappAdapter,
    private readonly sms: SmsAdapter,
  ) {}

  // ─── Settings ─────────────────────────────────────────────────────────────

  async getSettings(tenantId: string) {
    const settings = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationSettings.findUnique({ where: { tenantId } }),
    );

    if (!settings) {
      return {
        whatsappEnabled: false,
        whatsappPhoneNumberId: null,
        whatsappBusinessAcctId: null,
        whatsappAccessToken: null,
        smsEnabled: false,
        smsApiToken: null,
        smsSenderName: null,
        autoSendReceiptWhatsapp: false,
        autoSendReceiptSms: false,
      };
    }

    return {
      ...settings,
      whatsappAccessToken: maskSecret(settings.whatsappAccessToken && decryptSecret(settings.whatsappAccessToken)),
      smsApiToken: maskSecret(settings.smsApiToken && decryptSecret(settings.smsApiToken)),
    };
  }

  async updateSettings(tenantId: string, dto: UpdateNotificationSettingsDto) {
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationSettings.findUnique({ where: { tenantId } }),
    );

    // A masked value (starts with the bullet placeholder) means "unchanged" —
    // only overwrite the stored (encrypted) token when a real new value comes in.
    const nextWhatsappToken = isMasked(dto.whatsappAccessToken)
      ? existing?.whatsappAccessToken
      : dto.whatsappAccessToken
        ? encryptSecret(dto.whatsappAccessToken)
        : existing?.whatsappAccessToken;

    const nextSmsToken = isMasked(dto.smsApiToken)
      ? existing?.smsApiToken
      : dto.smsApiToken
        ? encryptSecret(dto.smsApiToken)
        : existing?.smsApiToken;

    const data = {
      whatsappEnabled: dto.whatsappEnabled ?? existing?.whatsappEnabled ?? false,
      whatsappPhoneNumberId: dto.whatsappPhoneNumberId ?? existing?.whatsappPhoneNumberId ?? null,
      whatsappBusinessAcctId: dto.whatsappBusinessAcctId ?? existing?.whatsappBusinessAcctId ?? null,
      whatsappAccessToken: nextWhatsappToken ?? null,
      smsEnabled: dto.smsEnabled ?? existing?.smsEnabled ?? false,
      smsApiToken: nextSmsToken ?? null,
      smsSenderName: dto.smsSenderName ?? existing?.smsSenderName ?? null,
      autoSendReceiptWhatsapp: dto.autoSendReceiptWhatsapp ?? existing?.autoSendReceiptWhatsapp ?? false,
      autoSendReceiptSms: dto.autoSendReceiptSms ?? existing?.autoSendReceiptSms ?? false,
    };

    await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationSettings.upsert({
        where: { tenantId },
        update: data,
        create: { tenantId, ...data },
      }),
    );

    return this.getSettings(tenantId);
  }

  // ─── Sending ──────────────────────────────────────────────────────────────

  async send(tenantId: string, dto: SendMessageDto) {
    const settings = await this.prisma.withTenant(tenantId, (tx) =>
      tx.notificationSettings.findUnique({ where: { tenantId } }),
    );

    const log = await this.prisma.withTenant(tenantId, (tx) =>
      tx.messageLog.create({
        data: {
          tenantId,
          channel: dto.channel,
          recipientPhone: dto.to,
          body: dto.body,
          status: 'PENDING',
          relatedInvoiceId: dto.relatedInvoiceId,
        },
      }),
    );

    try {
      const providerMessageId = await this.dispatch(dto.channel, dto.to, dto.body, settings);
      return this.prisma.withTenant(tenantId, (tx) =>
        tx.messageLog.update({
          where: { id: log.id },
          data: { status: 'SENT', providerMessageId },
        }),
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return this.prisma.withTenant(tenantId, (tx) =>
        tx.messageLog.update({
          where: { id: log.id },
          data: { status: 'FAILED', errorMessage },
        }),
      );
    }
  }

  private async dispatch(
    channel: MessageChannel,
    to: string,
    body: string,
    settings: NotificationSettings | null,
  ): Promise<string> {
    if (channel === 'WHATSAPP') {
      if (!settings?.whatsappEnabled) throw new BadRequestException('WhatsApp is not enabled for this tenant');
      const { providerMessageId } = await this.whatsapp.send(to, body, {
        phoneNumberId: settings.whatsappPhoneNumberId ?? '',
        accessToken: settings.whatsappAccessToken ? decryptSecret(settings.whatsappAccessToken) : '',
      });
      return providerMessageId;
    }

    if (!settings?.smsEnabled) throw new BadRequestException('SMS is not enabled for this tenant');
    const { providerMessageId } = await this.sms.send(to, body, {
      apiToken: settings.smsApiToken ? decryptSecret(settings.smsApiToken) : '',
      senderName: settings.smsSenderName ?? undefined,
    });
    return providerMessageId;
  }

  // ─── Logs ─────────────────────────────────────────────────────────────────

  async getLogs(tenantId: string, page = 1, limit = 30) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.messageLog.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        tx.messageLog.count(),
      ]);
      return { items, total, page, limit };
    });
  }
}

function isMasked(value: string | undefined): boolean {
  return !!value && value.startsWith(MASKED_PREFIX);
}
