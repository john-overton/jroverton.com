'use client';

import { Modal as BSModal, Button } from 'react-bootstrap';
import { ReactNode } from 'react';

interface ModalProps {
  show: boolean;
  onHide: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Modal({ show, onHide, title, children, footer }: ModalProps) {
  return (
    <BSModal show={show} onHide={onHide} centered>
      <BSModal.Header closeButton>
        <BSModal.Title>{title}</BSModal.Title>
      </BSModal.Header>
      <BSModal.Body>{children}</BSModal.Body>
      {footer && (
        <BSModal.Footer>
          {footer}
        </BSModal.Footer>
      )}
    </BSModal>
  );
}


