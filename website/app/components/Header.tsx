'use client';

import { Navbar, Nav, Container } from 'react-bootstrap';
import { useState } from 'react';

export default function Header() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Navbar 
      expand="lg" 
      className="bg-white border-bottom border-light"
      style={{ minHeight: '70px' }}
      expanded={expanded}
    >
      <Container>
        <Navbar.Brand href="/" className="fw-bold fs-4">
          {/* Logo placeholder - replace with actual logo */}
          <span style={{ color: 'var(--cobalt-sky)' }}>JO</span>
        </Navbar.Brand>
        <Navbar.Toggle 
          aria-controls="basic-navbar-nav"
          onClick={() => setExpanded(!expanded)}
        />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link 
              href="/" 
              className="px-3"
              onClick={() => setExpanded(false)}
            >
              Home
            </Nav.Link>
            <Nav.Link 
              href="#about" 
              className="px-3"
              onClick={() => setExpanded(false)}
            >
              About
            </Nav.Link>
            <Nav.Link 
              href="#projects" 
              className="px-3"
              onClick={() => setExpanded(false)}
            >
              Projects
            </Nav.Link>
            <Nav.Link 
              href="#contact" 
              className="px-3"
              onClick={() => setExpanded(false)}
            >
              Contact
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

