import { Container } from 'react-bootstrap';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BlogPostCard from '../components/BlogPostCard';
import { sortedBlogPosts } from '../components/blog';

export default function BlogPage() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />
      
      <main className="flex-grow-1 py-5">
        <Container>
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <header className="mb-5 text-center">
                <h1 className="display-4 fw-bold mb-3">Blog</h1>
                <p className="lead text-secondary-custom">
                  Thoughts on development, productivity, and building things
                </p>
              </header>

              <div className="blog-archive">
                {sortedBlogPosts.map((post) => {
                  const { component, ...metadata } = post;
                  return (
                    <BlogPostCard 
                      key={post.slug}
                      post={metadata}
                    />
                  );
                })}

                {sortedBlogPosts.length === 0 && (
                  <div className="text-center py-5">
                    <p className="text-secondary-custom">No blog posts yet. Check back soon!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
