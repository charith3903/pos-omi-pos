import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MessageChannel } from '@prisma/client';

export class SendMessageDto {
  @IsEnum(MessageChannel)
  channel: MessageChannel;

  @IsString()
  to: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  relatedInvoiceId?: string;
}
