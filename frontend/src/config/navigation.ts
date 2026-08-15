import { Home, MessageCircle, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type TabId = 'flow' | 'coach' | 'profile';

export interface TabDefinition {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

export const NAV_TABS: TabDefinition[] = [
  { id: 'flow', label: 'The Flow', icon: Home },
  { id: 'coach', label: 'The Coach', icon: MessageCircle },
  { id: 'profile', label: 'Profile', icon: Settings },
];
