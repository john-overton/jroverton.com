# Blog Post Components

This directory contains individual blog post components. Each blog post is a React component with associated metadata.

## Creating a New Blog Post

1. Create a new file in this directory (e.g., `my-new-post.tsx`)

2. Use this template:

```tsx
import { BlogPostMetadata } from './types';

export const metadata: BlogPostMetadata = {
  title: 'Your Blog Post Title',
  date: '2024-11-22', // ISO date format (YYYY-MM-DD)
  slug: 'your-post-slug', // URL-friendly slug (lowercase, hyphens)
  excerpt: 'A brief description of your post (optional)',
  author: 'John Overton' // Optional, defaults to site author
};

export default function YourPostName() {
  return (
    <article className="blog-post">
      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">Section Title</h2>
        <p className="mb-3">
          Your content here...
        </p>
      </section>
      
      {/* Add more sections as needed */}
    </article>
  );
}
```

3. Register your post in `index.ts`:

```tsx
import YourPostName, { metadata as yourPostMetadata } from './your-new-post';

export const blogPosts: BlogPost[] = [
  // ... existing posts
  {
    ...yourPostMetadata,
    component: YourPostName,
  },
];
```

## Blog Post Structure

Each blog post component should:
- Export a `metadata` object with required fields
- Export a default React component with the post content
- Use semantic HTML (`<article>`, `<section>`, `<h2>`, `<p>`, etc.)
- Follow the styling patterns established in existing posts

## Metadata Fields

- `title` (required): The blog post title
- `date` (required): Publication date in ISO format (YYYY-MM-DD)
- `slug` (required): URL-friendly identifier (lowercase, hyphens only)
- `excerpt` (optional): Short description shown in the archive
- `author` (optional): Author name, defaults to site author

## Styling

Blog posts use Bootstrap classes and custom CSS variables:
- Sections: `mb-5` for spacing
- Headings: `h3 fw-bold mb-3`
- Paragraphs: `mb-3` for spacing
- Use inline styles for custom colors: `style={{ color: 'var(--cobalt-sky)' }}`

## Examples

See `building-astryk.tsx` for a complete example.

