import { Badge as BSBadge } from 'react-bootstrap';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export default function Badge({ children, variant = 'primary', className = '' }: BadgeProps) {
  return (
    <BSBadge 
      bg={variant} 
      className={`badge-custom ${className}`}
    >
      {children}
    </BSBadge>
  );
}

