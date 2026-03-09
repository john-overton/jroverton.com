// Blog posts registry
// Import all blog posts here
import BuildingAstryk, { metadata as buildingAstrykMetadata } from './building-astryk';
import TheMissingDependency, { metadata as theMissingDependencyMetadata } from './the-missing-dependency';
import IteratingWithAi, { metadata as iteratingWithAiMetadata } from './iterating-with-ai';
import TenMinutePrTookThreeHours, { metadata as tenMinutePrTookThreeHoursMetadata } from './10-minute-pr-took-3-hours';
import { BlogPost } from './types';

// Add all blog posts to this array
export const blogPosts: BlogPost[] = [
  {
    ...buildingAstrykMetadata,
    component: BuildingAstryk,
  },
  {
    ...theMissingDependencyMetadata,
    component: TheMissingDependency,
  },
  {
    ...iteratingWithAiMetadata,
    component: IteratingWithAi,
  },
  {
    ...tenMinutePrTookThreeHoursMetadata,
    component: TenMinutePrTookThreeHours,
  },
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

