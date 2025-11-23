// Blog posts registry
// Import all blog posts here
import BuildingAstryk, { metadata as buildingAstrykMetadata } from './building-astryk';
import { BlogPost } from './types';

// Add all blog posts to this array
export const blogPosts: BlogPost[] = [
  {
    ...buildingAstrykMetadata,
    component: BuildingAstryk,
  },
  // Add more blog posts here as you create them
];

// Sort by date (newest first)
export const sortedBlogPosts = [...blogPosts].sort((a, b) => {
  const dateA = new Date(a.date).getTime();
  const dateB = new Date(b.date).getTime();
  return dateB - dateA;
});

// Helper function to get a blog post by slug
export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find(post => post.slug === slug);
}

