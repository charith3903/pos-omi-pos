import { MessageChannel } from '@prisma/client';

export interface SendMessageResult {
  providerMessageId: string;
}

export interface MessageAdapter {
  readonly channel: MessageChannel;

  /**
   * Sends `body` to `to` (E.164-ish phone number, provider-specific
   * formatting is the adapter's job). Throws on any non-success response —
   * callers (NotificationsService) are responsible for catching this and
   * recording the failure in MessageLog rather than propagating a 500.
   */
  send(to: string, body: string, credentials: Record<string, string>): Promise<SendMessageResult>;
}
