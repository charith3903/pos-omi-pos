'use client';

import { Wine } from 'lucide-react';
import { KotBoard } from '@/components/KotBoard';

export default function BarDisplay() {
  return (
    <KotBoard
      station="BAR"
      title="Bar Display (BOT)"
      icon={<Wine className="w-6 h-6" />}
      accentColor="text-cyan-400"
      emptyLabel="No pending drinks — bar is clear!"
      alertLabel="New BOT!"
    />
  );
}
