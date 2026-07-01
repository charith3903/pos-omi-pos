'use client';

import { ChefHat } from 'lucide-react';
import { KotBoard } from '@/components/KotBoard';

export default function KitchenDisplay() {
  return (
    <KotBoard
      station="KITCHEN"
      title="Kitchen Display (KOT)"
      icon={<ChefHat className="w-6 h-6" />}
      accentColor="text-orange-400"
      emptyLabel="No pending orders — kitchen is clear!"
      alertLabel="New KOT!"
    />
  );
}
