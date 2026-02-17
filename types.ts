import { LucideIcon } from 'lucide-react';

export interface SidebarItem {
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  hasSubmenu?: boolean;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  variant: 'primary' | 'white';
  subtitle?: string;
  info?: boolean;
}
