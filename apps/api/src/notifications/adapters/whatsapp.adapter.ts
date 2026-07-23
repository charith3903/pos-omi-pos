import { Injectable, Logger } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { MessageAdapter, SendMessageResult } from './message-adapter.interface';

const GRAPH_API_VERSION = 'v20.0';

/**
 * WhatsApp Business Cloud API (Meta), direct REST — same "thin fetch
 * wrapper, no SDK" approach as billing/adapters/paypal.adapter.ts.
 * Credentials are per-tenant (stored on NotificationSettings, decrypted by
 * the caller) rather than a single global account, since each tenant runs
 * their own WhatsApp Business number.
 */
@Injectable()
export class WhatsappAdapter implements MessageAdapter {
  readonly channel = MessageChannel.WHATSAPP;
  private readonly logger = new Logger(WhatsappAdapter.name);

  async send(
    to: string,
    body: string,
    credentials: { phoneNumberId: string; accessToken: string },
  ): Promise<SendMessageResult> {
    const { phoneNumberId, accessToken } = credentials;
    if (!phoneNumberId || !accessToken) {
      throw new Error('WhatsApp is not configured (missing phone number ID or access token)');
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizePhone(to),
          type: 'text',
          text: { body },
        }),
      },
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error?.message ?? `WhatsApp API error ${res.status}`;
      this.logger.warn(`WhatsApp send failed: ${message}`);
      throw new Error(message);
    }

    return { providerMessageId: data?.messages?.[0]?.id ?? 'unknown' };
  }
}

/** Strips leading '+'/spaces — Meta's API expects digits only (country code + number). */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}
