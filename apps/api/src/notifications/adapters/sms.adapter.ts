import { Injectable, Logger } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { MessageAdapter, SendMessageResult } from './message-adapter.interface';

/**
 * smsapi.com REST API — POST https://api.smsapi.com/sms.do, OAuth bearer
 * token, form-encoded body (see https://www.smsapi.com/docs/). Credentials
 * are per-tenant, same reasoning as whatsapp.adapter.ts.
 */
@Injectable()
export class SmsAdapter implements MessageAdapter {
  readonly channel = MessageChannel.SMS;
  private readonly logger = new Logger(SmsAdapter.name);

  async send(
    to: string,
    body: string,
    credentials: { apiToken: string; senderName?: string },
  ): Promise<SendMessageResult> {
    const { apiToken, senderName } = credentials;
    if (!apiToken) {
      throw new Error('SMS is not configured (missing smsapi.com access token)');
    }

    const params = new URLSearchParams({
      to: normalizePhone(to),
      message: body,
      format: 'json',
    });
    if (senderName) params.set('from', senderName);

    const res = await fetch(`https://api.smsapi.com/sms.do?${params.toString()}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      const message = data?.message ?? `smsapi.com error ${res.status}`;
      this.logger.warn(`SMS send failed: ${message}`);
      throw new Error(message);
    }

    return { providerMessageId: String(data?.list?.[0]?.id ?? data?.id ?? 'unknown') };
  }
}

/** smsapi.com expects digits only, no leading '+'. */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}
