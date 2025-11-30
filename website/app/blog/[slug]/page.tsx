import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
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
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); 
    
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
      
      <main className="flex-grow-1 pt-5 mt-5 px-3 px-sm-4 pb-5">
        <div className="max-w-2xl page-fade-in">
          <article className="blog-post">
            <header className="mb-5 pb-4">
              <div className="d-flex align-items-center gap-2 mb-3 small text-muted">
                <time dateTime={post.date} className="font-monospace">
                  {formatDate(post.date)}
                </time>
                {post.author && (
                  <>
                    <span>/</span>
                    <span>{post.author}</span>
                  </>
                )}
              </div>
              
              <h1 className="display-5 fw-bold mb-3 text-ink">
                {post.title}
              </h1>
            </header>

            <div className="blog-content" style={{ fontSize: '1.0625rem', lineHeight: '1.8' }}>
              <PostContent />
            </div>
            
            {/* Back to Archive Link */}
            <div className="mt-5 pt-5">
               <a href="/blog" className="text-decoration-none text-accent-blue hover-underline">
                 &larr; Back to Archive
               </a>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
