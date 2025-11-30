import Header from '../components/Header';
import Footer from '../components/Footer';
import Link from 'next/link';
import { sortedBlogPosts } from '../components/blog';

export default function BlogPage() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />
      
      <main className="flex-grow-1 pt-5 mt-5 px-3 px-sm-4 pb-5">
        <div className="max-w-2xl">
          <header className="mb-5 pb-4">
            <h1 className="h2 fw-bold mb-2 text-ink">The Archive</h1>
            <p className="small text-secondary mb-0">
              A collection of notes, drafts, and tutorials.
            </p>
          </header>

          <div className="d-flex flex-column gap-4">
            {sortedBlogPosts.map((post) => (
              <article key={post.slug} className="group">
                <div className="d-flex flex-column flex-sm-row align-items-sm-baseline gap-1 gap-sm-4 mb-1">
                  <span className="small text-muted font-monospace text-nowrap" style={{ width: '6rem', flexShrink: 0, fontSize: '0.75rem' }}>
                    {post.date}
                  </span>
                  <Link href={`/blog/${post.slug}`} className="text-decoration-none">
                    <h3 className="h5 fw-bold mb-0 text-ink cursor-pointer group-hover-text-green transition-colors hover-underline-dashed">
                      {post.title}
                    </h3>
                  </Link>
                </div>
                <p className="small text-secondary mb-0 lh-base" style={{ marginLeft: 'auto', maxWidth: '32rem' }}>
                  {/* Mobile margin reset handled by flex layout, but we need left margin on desktop to align with title. 
                      However, standard responsive classes are better. */}
                  <span className="d-none d-sm-inline-block" style={{ width: '7rem' }}></span>
                  {post.excerpt}
                </p>
              </article>
            ))}

            {sortedBlogPosts.length === 0 && (
              <div className="text-center py-5">
                <p className="text-secondary">No blog posts yet. Check back soon!</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
