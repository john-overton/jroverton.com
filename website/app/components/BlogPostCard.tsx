'use client';

import { Card } from 'react-bootstrap';
import Link from 'next/link';
import { BlogPostMetadata } from './blog/types';

interface BlogPostCardProps {
  post: BlogPostMetadata;
}

function formatDate(dateString: string): string {
  // Parse date string as local date to avoid timezone conversion issues
  // Format: YYYY-MM-DD
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

export default function BlogPostCard({ post }: BlogPostCardProps) {
  return (
    <Card 
      key={post.slug} 
      className="mb-4 border-0 shadow-sm blog-post-card"
      style={{ 
        transition: 'all 0.3s',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
      }}
    >
      <Card.Body className="p-4">
        <Link 
          href={`/blog/${post.slug}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="d-flex justify-content-between align-items-start mb-2">
            <h2 className="h4 fw-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {post.title}
            </h2>
            <span className="text-secondary-custom" style={{ fontSize: '0.875rem', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
              {formatDate(post.date)}
            </span>
          </div>
          {post.excerpt && (
            <p className="text-secondary-custom mb-0" style={{ fontSize: '1rem', lineHeight: '1.6' }}>
              {post.excerpt}
            </p>
          )}
          <div className="mt-3">
            <span 
              style={{ 
                color: 'var(--cobalt-sky)', 
                fontWeight: '600',
                fontSize: '0.875rem'
              }}
            >
              Read more →
            </span>
          </div>
        </Link>
      </Card.Body>
    </Card>
  );
}

