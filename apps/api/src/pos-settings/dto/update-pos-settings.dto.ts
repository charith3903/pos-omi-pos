import { IsEnum } from 'class-validator';
import { PosViewMode } from '@prisma/client';

export class UpdatePosSettingsDto {
  @IsEnum(PosViewMode)
  posViewMode: PosViewMode;
}
