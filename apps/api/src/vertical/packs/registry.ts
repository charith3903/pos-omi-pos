import { BusinessType, VerticalPack } from '@omnipos/types';
import { DEFAULT_PACK } from './default.pack';
import { ELECTRICAL_PACK } from './electrical.pack';
import { MOBILE_PACK } from './mobile.pack';
import { RENTAL_PACK } from './rental.pack';
import { RESTAURANT_PACK } from './restaurant.pack';
import { SPARE_PARTS_PACK } from './spare-parts.pack';
import { SUPERMARKET_PACK } from './supermarket.pack';
import { TEXTILE_PACK } from './textile.pack';

const REGISTRY: Partial<Record<BusinessType, VerticalPack>> = {
  SPARE_PARTS: SPARE_PARTS_PACK,
  RESTAURANT: RESTAURANT_PACK,
  SUPERMARKET: SUPERMARKET_PACK,
  TEXTILE: TEXTILE_PACK,
  MOBILE: MOBILE_PACK,
  ELECTRICAL: ELECTRICAL_PACK,
  RENTAL: RENTAL_PACK,
};

export function getPackForBusinessType(businessType: string): VerticalPack {
  return REGISTRY[businessType as BusinessType] ?? DEFAULT_PACK;
}
