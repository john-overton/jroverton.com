import { BlogPostMetadata } from './types';

export const metadata: BlogPostMetadata = {
  title: 'Deploy First, Pivot Fast: How Using My Own App Killed My Original Vision',
  date: '2024-11-22',
  slug: 'building-astryk',
  excerpt: 'A journey of building a productivity tool, learning from real usage, and pivoting based on actual needs rather than assumptions.',
  author: 'John Overton'
};

export default function BuildingAstryk() {
  return (
    <article className="blog-post">
      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">The Pre-Alpha Reality Check</h2>
        <p className="mb-3">
          Yesterday marked a milestone; I deployed the pre-alpha build and started dogfooding my own creation. Within hours of actual usage, a stark realization hit me like a freight train:
        </p>
        <div className="alert alert-warning border-start border-4 border-warning px-4 py-3 mb-4" style={{
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderLeftColor: 'var(--golden-hour) !important'
        }}>
          <strong>Kanban boards are kind of lame for solo users.</strong>
        </div>
        <p className="mb-3">
          This wasn't a flaw in my implementation. It was a fundamental mismatch between the tool and the use case. Kanban thrives in team environments where visualizing workflow stages matters. But as an individual user, the ceremony of moving cards through columns feels like unnecessary friction.
        </p>
        <p>
          The truth is simpler than I wanted to admit: as a solo user, you don't care if something is "in progress." You're already intimately aware of what you're working on. What matters is binary: done or not done.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">The Pivot: Embracing Simplicity</h2>
        <p className="mb-3">
          This realization isn't a failure; it's a gift. Real usage revealed what I actually need: a note app with smart checklists and activity tracking. The visual feedback component (the heatmap) remains crucial; that dopamine hit from seeing your productivity visualized is powerful motivation. But the kanban layer? That was complexity masquerading as organization.
        </p>
        <p className="mb-3">
          So Astryk is evolving. Instead of forcing a square peg into a round hole, I'm leaning into what actually works. The core vision remains intact: beautiful visual activity tracking that gamifies productivity. But the execution is becoming more refined, more focused on the actual needs of individual users rather than borrowed paradigms from team collaboration tools.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">What's Next</h2>
        <p className="mb-3">
          The path forward is clear. Astryk will become the notes app I need it to be: one that respects the way individuals actually work. Smart checklists that understand context. Activity tracking that motivates without overwhelming. A clean, focused interface that gets out of your way.
        </p>
        <p className="mb-3">
          Building in public means sharing these pivots, these moments of clarity that come from actual usage. The pre-alpha taught me more in one day than weeks of planning could have. That's the beauty of shipping early; reality has a way of cutting through assumptions.
        </p>
        <p>
          Astryk is still in its infancy, but it's already teaching me valuable lessons about product development and the importance of dogfooding. Sometimes the best features are the ones you don't build.
        </p>
      </section>
    </article>
  );
}

