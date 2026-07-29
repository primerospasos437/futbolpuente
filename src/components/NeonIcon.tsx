import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  size?: number;
  className?: string;
  color?: string;
};

export default function NeonIcon({ icon: Icon, size = 18, className = "", color }: Props) {
  return <Icon size={size} className={`neon-icon ${className}`} style={color ? { color } : undefined} />;
}
