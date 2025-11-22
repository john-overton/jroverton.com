import { Alert } from 'react-bootstrap';
import { ReactNode } from 'react';

interface BannerProps {
  variant?: 'success' | 'info' | 'warning' | 'danger';
  children: ReactNode;
  dismissible?: boolean;
  onClose?: () => void;
  className?: string;
}

export default function Banner({ 
  variant = 'info', 
  children, 
  dismissible = false,
  onClose,
  className = '' 
}: BannerProps) {
  return (
    <Alert 
      variant={variant} 
      dismissible={dismissible}
      onClose={onClose}
      className={`alert-custom ${className}`}
    >
      {children}
    </Alert>
  );
}

