# Creating Blog Posts

This guide explains how to create and publish new blog posts on jroverton.com.

## Overview

The blog system uses a component-based architecture where each blog post is a React component with associated metadata. All blog posts are stored in `website/app/components/blog/` and automatically appear in the blog archive.

## Quick Start

1. Create a new file in `website/app/components/blog/`
2. Export metadata and component
3. Register it in `website/app/components/blog/index.ts`
4. Done! The post will appear automatically

## Step-by-Step Guide

### Step 1: Create the Blog Post File

Create a new file in `website/app/components/blog/` with a descriptive filename (use kebab-case):

```
website/app/components/blog/my-awesome-post.tsx
```

### Step 2: Use the Template

Copy this template into your new file:

```tsx
import { BlogPostMetadata } from './types';

export const metadata: BlogPostMetadata = {
  title: 'Your Blog Post Title',
  date: '2024-11-22', // ISO date format (YYYY-MM-DD)
  slug: 'my-awesome-post', // Must match filename (without .tsx)
  excerpt: 'A brief, compelling description of your post that will appear in the archive.',
  author: 'John Overton' // Optional, defaults to site author
};

export default function MyAwesomePost() {
  return (
    <article className="blog-post">
      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">Section Title</h2>
        <p className="mb-3">
          Your first paragraph here. This is where you introduce your topic.
        </p>
        <p className="mb-3">
          Continue with more paragraphs as needed. Each paragraph should have the `mb-3` class for spacing.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">Another Section</h2>
        <p className="mb-3">
          You can have multiple sections. Each section should be wrapped in a `section` tag with `mb-5` class.
        </p>
      </section>

      {/* Add more sections as needed */}
    </article>
  );
}
```

### Step 3: Fill in the Metadata

Update the metadata object with your post details:

- **title**: The full title of your blog post
- **date**: Publication date in ISO format (YYYY-MM-DD)
- **slug**: URL-friendly identifier (lowercase, hyphens only). Should match your filename without `.tsx`
- **excerpt**: Short description (1-2 sentences) shown in the blog archive
- **author**: Optional, defaults to "John Overton"

### Step 4: Write Your Content

Write your blog post content using the provided structure:

- Use `<section>` tags for major sections
- Use `<h2>` with classes `h3 fw-bold mb-3` for section headings
- Use `<p>` tags with `mb-3` class for paragraphs
- Maintain consistent spacing

### Step 5: Register Your Post

Open `website/app/components/blog/index.ts` and add your post to the registry:

```tsx
import BuildingAstryk, { metadata as buildingAstrykMetadata } from './building-astryk';
import MyAwesomePost, { metadata as myAwesomePostMetadata } from './my-awesome-post'; // Add this

export const blogPosts: BlogPost[] = [
  {
    ...buildingAstrykMetadata,
    component: BuildingAstryk,
  },
  {
    ...myAwesomePostMetadata, // Add this
    component: MyAwesomePost,  // Add this
  },
];
```

### Step 6: Test Your Post

1. Start the development server:
   ```bash
   cd website
   npm run dev
   ```

2. Visit `http://localhost:3000/blog` to see your post in the archive
3. Click on your post to view the full article at `/blog/[your-slug]`

## Content Formatting Guidelines

### Sections

Each major section should be wrapped in a `<section>` tag with `mb-5` class:

```tsx
<section className="mb-5">
  <h2 className="h3 fw-bold mb-3">Section Title</h2>
  {/* Content */}
</section>
```

### Headings

Use `<h2>` tags with Bootstrap classes for section headings:

```tsx
<h2 className="h3 fw-bold mb-3">Your Heading</h2>
```

### Paragraphs

Use `<p>` tags with `mb-3` class for spacing:

```tsx
<p className="mb-3">
  Your paragraph text here.
</p>
```

### Callout Boxes

For important quotes or highlights, use Bootstrap alert classes:

```tsx
<div className="alert alert-warning border-start border-4 border-warning px-4 py-3 mb-4" 
     style={{
       backgroundColor: 'rgba(245, 158, 11, 0.1)',
       borderLeftColor: 'var(--golden-hour) !important'
     }}>
  <strong>Your important message here.</strong>
</div>
```

### Lists

For unordered lists:

```tsx
<ul className="mb-3">
  <li>First item</li>
  <li>Second item</li>
</ul>
```

For ordered lists:

```tsx
<ol className="mb-3">
  <li>First item</li>
  <li>Second item</li>
</ol>
```

### Code Blocks

For inline code, use `<code>` tags:

```tsx
<p>
  Use the <code>npm install</code> command to install dependencies.
</p>
```

For code blocks, use `<pre><code>`:

```tsx
<pre className="bg-light p-3 rounded mb-3">
  <code>{`const example = "code here";`}</code>
</pre>
```

## Best Practices

1. **Consistent Naming**: Use kebab-case for filenames and slugs (e.g., `my-awesome-post.tsx`)

2. **Date Format**: Always use ISO format (YYYY-MM-DD) for dates

3. **Excerpts**: Keep excerpts concise (1-2 sentences, ~150 characters)

4. **Slug Uniqueness**: Ensure each slug is unique across all blog posts

5. **Component Names**: Use PascalCase for component names (e.g., `MyAwesomePost`)

6. **Spacing**: Maintain consistent spacing using Bootstrap margin classes (`mb-3`, `mb-5`)

7. **Semantic HTML**: Use semantic HTML elements (`<article>`, `<section>`, `<h2>`, `<p>`)

## File Structure

```
website/
├── app/
│   ├── components/
│   │   └── blog/
│   │       ├── index.ts              # Blog registry
│   │       ├── types.ts              # TypeScript types
│   │       ├── building-astryk.tsx   # Example post
│   │       └── your-new-post.tsx     # Your new post
│   └── blog/
│       ├── page.tsx                  # Blog archive
│       └── [slug]/
│           └── page.tsx              # Individual post page
```

## Example: Complete Blog Post

Here's a complete example of a blog post:

```tsx
import { BlogPostMetadata } from './types';

export const metadata: BlogPostMetadata = {
  title: 'Getting Started with Next.js',
  date: '2024-11-22',
  slug: 'getting-started-with-nextjs',
  excerpt: 'Learn how to build modern web applications with Next.js and React.',
  author: 'John Overton'
};

export default function GettingStartedWithNextjs() {
  return (
    <article className="blog-post">
      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">Introduction</h2>
        <p className="mb-3">
          Next.js is a powerful React framework that makes it easy to build production-ready web applications.
        </p>
        <p className="mb-3">
          In this post, we'll explore the basics of getting started with Next.js.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">Installation</h2>
        <p className="mb-3">
          To get started, create a new Next.js project:
        </p>
        <pre className="bg-light p-3 rounded mb-3">
          <code>{`npx create-next-app@latest my-app`}</code>
        </pre>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">Conclusion</h2>
        <p className="mb-3">
          Next.js provides a great developer experience and powerful features out of the box.
        </p>
      </section>
    </article>
  );
}
```

## Troubleshooting

### Post Not Appearing in Archive

1. Check that you've registered the post in `index.ts`
2. Verify the import statement is correct
3. Check for TypeScript errors: `npm run build`
4. Ensure the slug is unique

### TypeScript Errors

1. Verify metadata matches the `BlogPostMetadata` interface
2. Check that component name matches filename (PascalCase)
3. Ensure all imports are correct

### Styling Issues

1. Verify you're using the correct Bootstrap classes
2. Check that spacing classes (`mb-3`, `mb-5`) are applied
3. Use inline styles for custom colors: `style={{ color: 'var(--cobalt-sky)' }}`

## Need Help?

- Check the example post: `website/app/components/blog/building-astryk.tsx`
- Review the type definitions: `website/app/components/blog/types.ts`
- See the component README: `website/app/components/blog/README.md`

