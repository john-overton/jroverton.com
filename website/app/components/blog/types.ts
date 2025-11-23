export interface BlogPostMetadata {
  title: string;
  date: string; // ISO date string or Date object
  slug: string;
  excerpt?: string;
  author?: string;
}

export interface BlogPost extends BlogPostMetadata {
  component: React.ComponentType;
}

