import { BlogPostMetadata } from './types';

export const metadata: BlogPostMetadata = {
  title: 'The 10-Minute PR That Took 3 Hours',
  date: '2026-03-08',
  slug: '10-minute-pr-took-3-hours',
  excerpt: 'What appeared to be a 10-minute merge ended up being a 3-hour coding session once I started reviewing the implementation and thinking about how it should really work and why.',
  author: 'John Overton'
};

export default function TenMinutePrTookThreeHours() {
  return (
    <article className="blog-post">
      <section className="mb-5">
        <p className="mb-3">
          A contributor submitted a pull request to Sprout Track recently. They wanted to add breast milk storage tracking, and I was grateful for the contribution. The implementation was clean and logical: log stored breast milk, show the amount.
        </p>
        <p className="mb-3">
          What appeared to be a 10-minute merge ended up being a 3-hour coding session once I started reviewing the implementation and thinking about how it should really work and why.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">What &ldquo;Complete&rdquo; Actually Looks Like</h2>
        <p className="mb-3">
          The original implementation handled the straightforward case. But Sprout Track has existing users, established patterns, and layers of functionality that all have to stay in sync.
        </p>
        <p className="mb-3">
          Here&rsquo;s what the 3 hours looked like:
        </p>
        <p className="mb-3">
          <strong>Historical data capture.</strong> Users who&rsquo;ve been pumping and storing for weeks or months need a way to backfill. That means an adjustment flow, a way to set a baseline for people already deep into their routines.
        </p>
        <p className="mb-3">
          <strong>Mixed feed types.</strong> Some parents bottle-feed expressed breast milk. Some mix formula and breast milk. The storage feature has to understand that &ldquo;breast milk&rdquo; shows up in multiple contexts, and each one affects the stored amount differently.
        </p>
        <p className="mb-3">
          <strong>Recursive reporting.</strong> If a parent stores 10 ounces on Monday and consumes 4 on Tuesday, the report needs to show 6 remaining. Consumption can come from bottles logged across multiple days, adjustments can modify historical totals, and the daily view needs to reflect the running balance accurately.
        </p>
        <p className="mb-3">
          <strong>Daily stats integration.</strong> The current stored amount needs to surface in the daily summary view without cluttering the layout or breaking the existing hierarchy of information.
        </p>
        <p className="mb-3">
          <strong>Theming and context.</strong> Every new UI element has to respect the app&rsquo;s theming system. Colors, spacing, typography, all of it.
        </p>
        <p className="mb-3">
          <strong>Translations.</strong> Every new string, label, and status message needs translation entries for all supported languages.
        </p>
        <p className="mb-3">
          None of this was visible from the outside. And that&rsquo;s the point.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">Two Kinds of Complexity</h2>
        <p className="mb-3">
          There&rsquo;s a useful distinction here between technical complexity and UX complexity. They overlap, but they pull in different directions.
        </p>
        <p className="mb-3">
          Technical complexity is the stuff under the hood. Recursive calculations, data model decisions that ripple into reporting, migration paths for existing users, edge cases in how different feed types interact. Getting this wrong produces numbers that parents rely on to make decisions about feeding their child.
        </p>
        <p className="mb-3">
          UX complexity is about whether the feature makes sense to the person using it. Does the adjustment flow feel intuitive? Does the daily stats view still scan quickly with the new information? Does the storage tracker feel like it belongs in the app?
        </p>
        <p className="mb-3">
          Both require context. You can&rsquo;t solve either one by looking at the feature in isolation.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">The Missing Layer: Defined Considerations</h2>
        <p className="mb-3">
          Every project past a certain size carries a set of invisible constraints. Things that any new feature has to pass through before it ships. Not a heavy process document. Not a gate review. Just the stuff you check automatically because you&rsquo;ve lived in the codebase long enough to know where the landmines are.
        </p>
        <p className="mb-3">
          For Sprout Track, those considerations look something like: Does it handle existing users with historical data? Does it respect theming? Are translations covered? Does it integrate cleanly with the daily stats view? Does the reporting logic account for consumption against storage? Does it handle mixed feed types?
        </p>
        <p className="mb-3">
          Right now, that list lives in my head. I don&rsquo;t have it written down. That&rsquo;s a problem, because it means every contributor has to either guess at the constraints or submit something incomplete and wait for me to catch what&rsquo;s missing. That&rsquo;s not a fair setup for anyone.
        </p>
        <p className="mb-3">
          Defining those considerations explicitly is the next step. Not as bureaucracy. As architecture documentation. A short, living list that says: here&rsquo;s what every new feature in this project needs to account for. If the constraints only exist in your head, no one can meet them. Not a contributor. Not even a future version of yourself coming back to the project after a few months away.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">People Don&rsquo;t Know What They Don&rsquo;t Know</h2>
        <p className="mb-3">
          The contributor who submitted that PR did good work. They built something that functioned for the use case they understood. The gap wasn&rsquo;t effort or skill. It was visibility. They couldn&rsquo;t account for constraints they didn&rsquo;t know existed, and there was no documentation telling them what to look for. That&rsquo;s on me.
        </p>
      </section>
    </article>
  );
}
