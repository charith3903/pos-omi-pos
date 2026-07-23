import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;

  @IsOptional()
  @IsString()
  whatsappPhoneNumberId?: string;

  @IsOptional()
  @IsString()
  whatsappBusinessAcctId?: string;

  /** Plaintext token from the settings form. Omit / leave unset to keep the existing one. */
  @IsOptional()
  @IsString()
  whatsappAccessToken?: string;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsString()
  smsApiToken?: string;

  @IsOptional()
  @IsString()
  smsSenderName?: string;

  @IsOptional()
  @IsBoolean()
  autoSendReceiptWhatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSendReceiptSms?: boolean;
}
