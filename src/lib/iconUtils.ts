import * as Icons from 'lucide-react';

export const getDynamicIcon = (iconName: string) => {
  if (!iconName) return Icons.Tag;
  const formattedName = iconName.charAt(0).toUpperCase() + iconName.slice(1);
  return (Icons as any)[formattedName] || Icons.Tag;
};
