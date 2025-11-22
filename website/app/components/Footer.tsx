import { Container, Row, Col } from 'react-bootstrap';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      className="mt-auto"
      style={{ 
        backgroundColor: 'var(--text-primary)', 
        color: 'var(--white)',
        padding: '3rem 0 1rem'
      }}
    >
      <Container>
        <Row className="mb-4">
          <Col md={6} className="mb-4 mb-md-0">
            <h5 className="mb-3">Quick Links</h5>
            <ul className="list-unstyled">
              <li className="mb-2">
                <a 
                  href="/" 
                  style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none' }}
                  className="hover-opacity"
                >
                  Home
                </a>
              </li>
              <li className="mb-2">
                <a 
                  href="#about" 
                  style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none' }}
                  className="hover-opacity"
                >
                  About
                </a>
              </li>
              <li className="mb-2">
                <a 
                  href="#projects" 
                  style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none' }}
                  className="hover-opacity"
                >
                  Projects
                </a>
              </li>
              <li className="mb-2">
                <a 
                  href="#contact" 
                  style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none' }}
                  className="hover-opacity"
                >
                  Contact
                </a>
              </li>
            </ul>
          </Col>
          <Col md={6} className="text-md-end">
            <h5 className="mb-3">Connect</h5>
            <ul className="list-unstyled">
              <li className="mb-2">
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none' }}
                  className="hover-opacity"
                >
                  GitHub
                </a>
              </li>
              <li className="mb-2">
                <a 
                  href="https://linkedin.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none' }}
                  className="hover-opacity"
                >
                  LinkedIn
                </a>
              </li>
              <li className="mb-2">
                <a 
                  href="mailto:contact@jroverton.com" 
                  style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none' }}
                  className="hover-opacity"
                >
                  Email
                </a>
              </li>
              <li className="mb-2">
                <a 
                  href="https://twitter.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none' }}
                  className="hover-opacity"
                >
                  Twitter
                </a>
              </li>
            </ul>
          </Col>
        </Row>
        <Row>
          <Col className="text-center pt-3 border-top" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
            <p className="mb-0" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem' }}>
              © {currentYear} Copyright John Overton. All Rights Reserved.
            </p>
          </Col>
        </Row>
      </Container>
      <style jsx>{`
        .hover-opacity:hover {
          opacity: 0.7;
          transition: opacity 0.2s;
        }
      `}</style>
    </footer>
  );
}

