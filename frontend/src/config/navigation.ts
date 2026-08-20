import { BookOpen, Home, MessageCircle, Settings, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type TabId = 'flow' | 'library' | 'coach' | 'profile' | 'admin';

export interface TabDefinition {
  id: TabId;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const NAV_TABS: TabDefinition[] = [
  { id: 'flow', label: 'The Flow', icon: Home },
  { id: 'library', label: 'Exercises', icon: BookOpen },
  { id: 'coach', label: 'The Coach', icon: MessageCircle },
  { id: 'profile', label: 'Profile', icon: Settings },
  { id: 'admin', label: 'Admin', icon: Shield, adminOnly: true },
];
