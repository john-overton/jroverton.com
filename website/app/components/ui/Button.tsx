import { Button as BSButton, ButtonProps } from 'react-bootstrap';

interface CustomButtonProps extends ButtonProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline-primary' | 'outline-secondary';
}

export default function Button({ className = '', ...props }: CustomButtonProps) {
  return (
    <BSButton 
      className={`btn-custom ${className}`}
      {...props}
    />
  );
}

