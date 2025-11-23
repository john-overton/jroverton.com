import { Container } from 'react-bootstrap';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import AuthorCard from '../../components/AuthorCard';
import { getBlogPostBySlug, blogPosts } from '../../components/blog';

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Generate static params for all blog posts
export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  return {
    title: `${post.title} | John Overton`,
    description: post.excerpt || post.title,
    openGraph: {
      title: post.title,
      description: post.excerpt || post.title,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const formatDate = (dateString: string) => {
    // Parse date string as local date to avoid timezone conversion issues
    // Format: YYYY-MM-DD
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const PostContent = post.component;

  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />
      
      <main className="flex-grow-1 py-5">
        <Container>
          <div className="row justify-content-center">
            <div className="col-lg-8">
              {/* Author Card */}
              <AuthorCard />

              {/* Blog Post */}
              <article className="blog-post">
                <header className="mb-4">
                  <h1 className="display-5 fw-bold mb-3">
                    {post.title}
                  </h1>
                  <div className="d-flex align-items-center text-secondary-custom mb-4" style={{ fontSize: '0.875rem' }}>
                    <time dateTime={post.date}>
                      {formatDate(post.date)}
                    </time>
                    {post.author && (
                      <>
                        <span className="mx-2">•</span>
                        <span>{post.author}</span>
                      </>
                    )}
                  </div>
                </header>

                <div className="blog-content" style={{ 
                  fontSize: '1.125rem', 
                  lineHeight: '1.8',
                  color: 'var(--text-primary)'
                }}>
                  <PostContent />
                </div>
              </article>
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}

