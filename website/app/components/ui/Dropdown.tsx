'use client';

import { Dropdown as BSDropdown } from 'react-bootstrap';
import { ReactNode } from 'react';

interface DropdownProps {
  title: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

export default function Dropdown({ title, children, variant = 'primary' }: DropdownProps) {
  return (
    <BSDropdown>
      <BSDropdown.Toggle variant={variant} className="btn-custom">
        {title}
      </BSDropdown.Toggle>
      <BSDropdown.Menu>
        {children}
      </BSDropdown.Menu>
    </BSDropdown>
  );
}

