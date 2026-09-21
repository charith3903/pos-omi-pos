import { IsOptional, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  outletId?: string;
}

export class RenameDeviceDto {
  @IsString()
  name: string;
}
