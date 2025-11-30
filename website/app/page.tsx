'use client';

import Header from './components/Header';
import Footer from './components/Footer';
import Link from 'next/link';
import { sortedBlogPosts } from './components/blog';
import { Mail } from 'lucide-react';

export default function Home() {
  const recentPosts = sortedBlogPosts.slice(0, 5);

  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />
      
      <main className="flex-grow-1 pt-5 mt-5 px-3 px-sm-4 pb-5">
        <div className="max-w-2xl">
          
          {/* Hero Section */}
          <div className="page-fade-in">
            <header className="mb-5">
              <div className="d-flex flex-column flex-sm-row align-items-center align-items-sm-start gap-4">
                <img
                  src="/johno-headshot.jpg"
                  alt="John Overton"
                  className="rounded-circle"
                  style={{ width: '120px', height: '120px', objectFit: 'cover', objectPosition: 'center top' }}
                />
                <div className="flex-grow-1 text-center text-sm-start">
                  <h1 className="display-4 fw-bold mb-3 text-ink">
                    Hello, I'm John.
                  </h1>
                  <p className="lead text-secondary mb-4 fs-5">
                    Digital tinkerer building tools for how I actually work. Currently making Astryk, a notes app with smart checklists and weekly rollups for people who think in tasks. Dad, skier, caffeine-dependent.
                  </p>
                </div>
              </div>
            </header>

            {/* Projects/Links Section */}
            <section className="mb-5">
              <h2 className="small text-uppercase text-muted fw-bold mb-3" style={{ letterSpacing: '0.1em' }}>
                Projects
              </h2>
              <div className="row g-3">
                <div className="col-12 col-sm-6">
                  <Link href="https://astryk.com" className="text-decoration-none">
                    <div className="glass-card p-3 rounded-3 h-100 group" style={{ '--hover-border': 'var(--accent-green)' } as any}>
                      <div className="d-flex align-items-center gap-3">
                        <img src="/astryk.svg" alt="Astryk" className="fs-3" style={{ width: '24px', height: '24px' }} />
                        <div>
                          <div className="fw-bold text-ink small">Astryk</div>
                          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>Notes with smart checklists</div>
                        </div>
                        <i className="ph ph-arrow-right ms-auto text-accent-green opacity-0 group-hover-opacity-100 transition-opacity"></i>
                      </div>
                    </div>
                  </Link>
                </div>
                <div className="col-12 col-sm-6">
                  <Link href="https://sprout-track.com" className="text-decoration-none">
                    <div className="glass-card p-3 rounded-3 h-100 group" style={{ '--hover-border': 'var(--accent-blue)' } as any}>
                      <div className="d-flex align-items-center gap-3">
                        <img src="/sprout-256.png" alt="Sprout Track" className="fs-3" style={{ width: '24px', height: '24px' }} />
                        <div>
                          <div className="fw-bold text-ink small">Sprout Track</div>
                          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>Baby tracking app</div>
                        </div>
                        <i className="ph ph-arrow-right ms-auto text-accent-blue opacity-0 group-hover-opacity-100 transition-opacity"></i>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </section>

            {/* Latest Thoughts */}
            <section className="mb-5">
              <div className="d-flex justify-content-between align-items-end mb-3">
                <h2 className="small text-uppercase text-muted fw-bold mb-0" style={{ letterSpacing: '0.1em' }}>Latest Thoughts</h2>
                <Link href="/blog" className="small text-accent-blue text-decoration-none hover-underline">View All</Link>
              </div>
              
              <div className="d-flex flex-column gap-3">
                {recentPosts.map(post => (
                  <Link key={post.slug} href={`/blog/${post.slug}`} className="text-decoration-none">
                    <article className="glass-card p-3 rounded-3 group cursor-pointer" style={{ '--hover-border': 'var(--accent-blue)' } as any}>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h3 className="fw-bold fs-5 text-ink mb-0 group-hover-text-blue transition-colors">{post.title}</h3>
                        <span className="small text-muted font-monospace text-nowrap ms-2">{post.date}</span>
                      </div>
                      <p className="small text-secondary mb-2 lh-sm">
                        {post.excerpt || 'No excerpt available.'}
                      </p>
                      <div className="d-flex align-items-center gap-2">
                        <span className="small text-accent-blue ms-auto opacity-0 group-hover-opacity-100 transition-opacity">Read more -&gt;</span>
                      </div>
                    </article>
                  </Link>
                ))}
                {recentPosts.length === 0 && (
                  <p className="text-muted">No posts yet.</p>
                )}
              </div>
            </section>

            {/* About Section */}
            <section id="about" className="page-fade-in">
              <div className="glass-panel p-4 p-sm-5 rounded-4">
                <h2 className="h3 fw-bold mb-4">About Me</h2>

                <div className="font-typewriter text-secondary">
                  <p className="mb-3">
                    I've spent years in transit operations building systems that keep fleets moving: paratransit, microtransit, fixed route. The work taught me how to think in logistics and edge cases, and gave me a deep appreciation for software that solves real problems instead of inventing new ones.
                  </p>
                  <p className="mb-3">
                    Outside of work, I'm building toward independence. Astryk is my current focus, a productivity tool born from my own frustrations with existing apps. I also run Sprout Track, a baby tracking app I built when my son was born.
                  </p>
                  <p className="mb-3">
                    I believe in owning your outcomes, building things that actually work, and validating ideas by using them myself. If it works for me, there's a decent chance it works for someone else.
                  </p>
                  <p className="mb-4">
                    When I'm not at a keyboard, I'm skiing, wrenching on cars, playing video games, or outside with my family.
                  </p>

                  <div className="mt-4 pt-4 border-top border-secondary border-opacity-25 border-dashed">
                    <h3 className="h6 fw-bold mb-3">Connect</h3>
                    <div className="d-flex gap-3">
                      <a href="mailto:john@jroverton.com" className="text-decoration-none text-secondary hover-text-blue transition-colors" title="Email">
                        <Mail size={20} style={{ width: '20px', height: '20px' }} />
                      </a>
                      <a href="https://x.com/overton_stuff" className="text-decoration-none text-secondary hover-text-blue transition-colors" title="X (Twitter)">
                        <img src="/x-logo.svg" alt="X" style={{ width: '20px', height: '20px', filter: 'invert(0.5)' }} className="hover-filter-invert-0" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
