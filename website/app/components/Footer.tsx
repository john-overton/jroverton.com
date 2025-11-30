import { Container } from 'react-bootstrap';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-4 mt-auto text-center small text-muted">
      <Container>
        <p className="mb-0" style={{ fontSize: '0.75rem' }}>
          &copy; {currentYear} John Overton. Crafted with <i className="ph-fill ph-heart text-accent-green mx-1"></i> and simple code.
        </p>
      </Container>
    </footer>
  );
}
