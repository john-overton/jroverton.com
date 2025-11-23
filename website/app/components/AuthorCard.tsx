import { Card } from 'react-bootstrap';

export default function AuthorCard() {
  return (
    <Card className="mb-4 border-0 shadow-sm" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="d-flex align-items-center p-4">
        <div 
          className="rounded-circle d-flex align-items-center justify-content-center me-3"
          style={{
            width: '64px',
            height: '64px',
            backgroundColor: 'var(--cobalt-sky)',
            color: 'white',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            flexShrink: 0
          }}
        >
          JO
        </div>
        <div>
          <h5 className="mb-1 fw-bold">John Overton</h5>
          <p className="mb-0 text-secondary-custom" style={{ fontSize: '0.875rem' }}>
            Developer & Creator
          </p>
        </div>
      </div>
    </Card>
  );
}

