import { BlogPostMetadata } from './types';

export const metadata: BlogPostMetadata = {
  title: 'The Missing Dependency: Why Human Context is the Package AI Can\'t Install',
  date: '2025-12-23',
  slug: 'the-missing-dependency',
  excerpt: 'Your project compiles. The tests pass. But something is off. The problem isn\'t the code — it\'s a missing dependency that no AI agent is going to install for you: human context.',
  author: 'John Overton'
};

export default function TheMissingDependency() {
  return (
    <article className="blog-post">
      <section className="mb-5">
        <p className="mb-3">
          Your project compiles. The tests pass. The AI generated clean, functional code across dozens of files. Everything looks right. But something is off, and you can&apos;t quite put your finger on it until a real user sits down and the whole thing falls apart.
        </p>
        <p className="mb-3">
          The problem isn&apos;t the code. The problem is a missing dependency. Not one you&apos;ll find in a <code>package.json</code> or a <code>requirements.txt</code>, but one that&apos;s just as critical: human context. And unlike every other dependency in your stack, no AI agent is going to install it for you.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">The Dependency Nobody Declares</h2>
        <p className="mb-3">
          Every software project has a dependency tree. Frameworks, libraries, runtimes, build tools. We obsess over managing these. We lock versions, audit vulnerabilities, and automate updates. But the most important dependency in any AI-assisted project never gets declared anywhere, because it lives in the head of the person building the thing.
        </p>
        <p className="mb-3">
          Human context is understanding what you&apos;re building, who it&apos;s for, why it needs to work a certain way, and what happens when it doesn&apos;t. It&apos;s architecture, security, user experience, edge cases, deployment constraints, and business logic. The AI can&apos;t know what you don&apos;t tell it, and it definitely can&apos;t know what you don&apos;t know yourself.
        </p>
        <p className="mb-3">
          I keep seeing the same pattern play out. Someone fires up an AI coding agent, describes what they want in broad strokes, and gets back something that technically runs. It compiles. It renders. It does... something. But it doesn&apos;t do the right thing, because the person asking didn&apos;t fully understand the problem they were solving. And that gap between &ldquo;it works&rdquo; and &ldquo;it works correctly&rdquo; is where most AI-assisted projects quietly fall apart.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">It Starts With a Plan, But Not Just Any Plan</h2>
        <p className="mb-3">
          Everyone talks about planning. &ldquo;Plan before you build.&rdquo; Sure. But there&apos;s a difference between a plan that says &ldquo;build a dashboard with charts&rdquo; and a plan that says &ldquo;build a dashboard where operations managers can see real-time vehicle utilization by route, filterable by date range, with role-based access so dispatchers only see their assigned regions.&rdquo;
        </p>
        <p className="mb-3">
          The second plan gives an AI agent something to work with. The first one gives it permission to guess. And AI is very good at guessing confidently.
        </p>
        <p className="mb-3">
          This is where the missing dependency shows up first. The plan has to be informed by someone who understands the domain, the end user, the constraints, and the tradeoffs. You can use AI to help refine the plan, absolutely. But the seed of that plan, the &ldquo;why&rdquo; behind the &ldquo;what,&rdquo; has to come from a human who has real operational understanding of the problem space.
        </p>
        <p className="mb-3">
          Think of it like this: you wouldn&apos;t start a project without installing your database driver. You&apos;d get a runtime error the moment you tried to connect. Human context works the same way. Skip it, and you&apos;ll get runtime errors too. They&apos;ll just show up later, as confused users, broken workflows, and features that technically function but practically fail.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">The AI is Guessing. On Everything.</h2>
        <p className="mb-3">
          Here&apos;s something people don&apos;t think about enough. When you tell an AI to build a feature, it&apos;s making hundreds of micro-decisions you never specified. Should this button be disabled after submission? Should this list be sortable? Can the user drag and drop items to reorder them? What happens when the network request fails? What gets validated on the client versus the server? How should this behave on mobile versus desktop?
        </p>
        <p className="mb-3">
          The AI will answer all of these questions for you. It just won&apos;t answer them correctly, because it doesn&apos;t know your users, your product requirements, or your business logic. It&apos;s filling in blanks with reasonable defaults, and reasonable defaults are not the same as correct behavior.
        </p>
        <p className="mb-3">
          You have to be specific. You have to be deliberate. Not just about the big picture, but about the details that seem small until they aren&apos;t. &ldquo;I want this button here, and when clicked it should do X. If the user doesn&apos;t have permission, disable it and show a tooltip explaining why. Here&apos;s the error handling. These are the test cases. This is the expected output. This is how it should be secured.&rdquo; That level of specificity is what turns AI from a guess machine into a precision tool.
        </p>
        <p className="mb-3">
          This is also why tools like Cursor have taken off the way they have while platforms like Lovable and Replit&apos;s agent mode struggle with anything beyond a prototype. Cursor works because it feeds context directly from your codebase into the model. Developers already understand the concepts, the architecture, and the intent. They can quickly provide the context the AI needs, and that&apos;s what makes it so powerful. The tools that try to abstract away the need for human context are the ones that hit a wall the fastest, because you can&apos;t abstract away understanding. The AI&apos;s ability to read and interpret code does not mean it magically understands the full context of the functionality. Reading code and understanding intent are two very different things.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">Context is Finite. Build Accordingly.</h2>
        <p className="mb-3">
          There&apos;s a practical constraint that makes human context even more important: AI output has hard limits. An AI model is not going to produce 100,000 tokens of detailed project plan in a single pass. At best, you&apos;ll get around 2,000 tokens of useful planning output at a time. That&apos;s roughly three to five solid feature descriptions.
        </p>
        <p className="mb-3">
          That means you have to build methodically. You can&apos;t dump your entire vision into a prompt and expect a comprehensive blueprint to come back. You have to iterate. Break the work into pieces. Define each piece with enough specificity that the AI can execute on it without filling in critical gaps on its own. Each feature description needs to cover what the UI should look like, what the interactions should be, how errors should be handled, what the tests should verify, and how the feature fits into the broader system.
        </p>
        <p className="mb-3">
          This is also why the &ldquo;just let AI agents run autonomously&rdquo; narrative is misleading. Anthropic recently made headlines when researcher Nicholas Carlini tasked 16 Claude agents with building a C compiler in Rust. Over about 2,000 sessions and $20,000 in API costs, the agents produced a 100,000-line compiler that could build the Linux kernel across multiple architectures. It&apos;s an impressive demonstration, and the coordination between agents was genuinely clever.
        </p>
        <p className="mb-3">
          But look at what made it work. Carlini didn&apos;t just say &ldquo;build a C compiler&rdquo; and walk away. He built an elaborate testing harness. He used GCC as an oracle to verify correctness. He wrote custom test suites and designed feedback loops so the agents could tell whether they were making progress. The agents were also running on a model that had been trained on vast amounts of existing compiler source code, including open source C compilers like chibicc. The existing GCC torture test suite, with its decades of accumulated edge cases, served as the guardrails.
        </p>
        <p className="mb-3">
          The context was massive, carefully structured, and provided by a human who understood compilers, testing methodology, and how to decompose a monolithic problem into parallelizable tasks. That&apos;s not &ldquo;AI building from scratch.&rdquo; That&apos;s a deeply knowledgeable human constructing the right environment for AI to operate in. The missing dependency was installed before the agents ever started.
        </p>
        <p className="mb-3">
          You can&apos;t just put 10 agents together and say &ldquo;build me an app that simulates a rocket going into space&rdquo; and expect to come back to a clone of Kerbal Space Program. The vision, the decomposition, the acceptance criteria, and the verification, all of that has to come from someone who understands what &ldquo;done&rdquo; looks like. You have to spell it out, piece by piece, because that&apos;s how the work actually gets done.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">You Can Build Without Knowing. You Can&apos;t Maintain Without Knowing.</h2>
        <p className="mb-3">
          Here&apos;s the thing that trips people up. You can absolutely build a working application without deeply understanding the underlying code. AI will generate it, you&apos;ll deploy it, and for a while everything looks fine.
        </p>
        <p className="mb-3">
          Then something breaks. Or a requirement changes. Or a user reports an edge case you never considered. And now you&apos;re staring at a codebase you don&apos;t understand, asking the AI to fix something, and neither of you has enough context to do it cleanly.
        </p>
        <p className="mb-3">
          This is where the failure loops start. You describe the bug. The AI patches it. The patch breaks something else. You describe the new break. The AI patches that. Each iteration drifts further from a coherent architecture because nobody in the loop, human or AI, has a clear mental model of the whole system. It&apos;s dependency hell, except the missing package is your own understanding.
        </p>
        <p className="mb-3">
          I&apos;ve lived this. I&apos;ve watched it happen. And the difference between a productive AI-assisted session and a frustrating spiral almost always comes down to whether the human understands not just that something is broken, but why it&apos;s broken.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">Why &ldquo;Why&rdquo; Matters More Than &ldquo;What&rdquo;</h2>
        <p className="mb-3">
          When you can articulate why something isn&apos;t working, you give the AI surgical precision. &ldquo;The button doesn&apos;t render after creating a new task because the React root isn&apos;t re-initializing after the autosave triggers a DOM replacement.&rdquo; That&apos;s a prompt that leads to a real fix.
        </p>
        <p className="mb-3">
          Compare that to &ldquo;the buttons don&apos;t work.&rdquo; That&apos;s a prompt that leads to a dozen attempts, each one thrashing in a different direction, because the AI has no anchor point for what&apos;s actually going wrong.
        </p>
        <p className="mb-3">
          The same principle applies to feature requests, architecture decisions, and security considerations. When you understand the why, you can communicate it. When you can communicate it, the AI can act on it. When you skip that understanding, you&apos;re hoping the AI fills in the gaps correctly. Sometimes it does. Often it doesn&apos;t. And you won&apos;t know the difference until it&apos;s a problem.
        </p>
        <p className="mb-3">
          This is the core of what makes human context a true dependency rather than a nice-to-have. Without it, every interaction with the AI is a partial prompt. You&apos;re passing incomplete arguments to a function and hoping the defaults are reasonable. Sometimes they are. But you&apos;re building on luck, not understanding.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">Installing the Dependency</h2>
        <p className="mb-3">
          So how do you actually install this missing dependency? It&apos;s not as simple as running a command, but there are practical habits that make a real difference.
        </p>
        <p className="mb-3">
          <strong>Document as you build.</strong> Every time the AI implements something, have it create or update documentation about what it did and why. This creates a feedback loop where future prompts have better context, and future debugging starts from a place of understanding rather than guesswork. Your documentation becomes the README for your own project&apos;s decision history.
        </p>
        <p className="mb-3">
          <strong>Understand your architecture before you generate code.</strong> You don&apos;t need to be an expert in every framework, but you need to know why you chose Next.js over plain React, why your data layer works the way it does, and what the boundaries are between your components. The AI will happily generate code that violates every architectural decision you&apos;ve made if you don&apos;t tell it not to.
        </p>
        <p className="mb-3">
          <strong>Own the debugging process.</strong> When something breaks, resist the urge to immediately paste the error into the AI and say &ldquo;fix this.&rdquo; Take a minute. Read the error. Think about what changed. Formulate a hypothesis. Then bring the AI in with that context. The difference in output quality is night and day.
        </p>
        <p className="mb-3">
          <strong>Treat the AI as a collaborator, not a black box.</strong> Review what it generates. Ask it to explain its decisions. Push back when something doesn&apos;t feel right. The more you engage with the output, the more your own understanding deepens, and the better your future prompts become. That&apos;s the feedback loop that separates people who build with AI from people who just generate with AI.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">The Human Advantage</h2>
        <p className="mb-3">
          The irony of AI-assisted development is that it makes human expertise more valuable, not less. Anyone can prompt an AI to generate a CRUD app. The advantage goes to the person who understands what the end user actually needs, how the system should behave under load, what happens when the database connection drops, and why that one edge case matters more than it looks like it does.
        </p>
        <p className="mb-3">
          Product thinking, operational knowledge, domain expertise. These aren&apos;t nice-to-haves in the age of AI-assisted development. They&apos;re the entire ballgame. The AI handles the syntax. You handle the substance.
        </p>
        <p className="mb-3">
          The best engineers I know who work with AI aren&apos;t the ones who write the most clever prompts. They&apos;re the ones who deeply understand the systems they&apos;re building and can translate that understanding into context the AI can use. They know what good looks like, so they can evaluate what the AI gives them. They know what should happen, so they can catch what shouldn&apos;t.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="h3 fw-bold mb-3">The Bottom Line</h2>
        <p className="mb-3">
          AI has dramatically lowered the barrier to building software. But it hasn&apos;t lowered the barrier to building software well. That still requires a human who understands the problem, the user, and the system. It requires someone who can plan with purpose, debug with understanding, and maintain with intention.
        </p>
        <p className="mb-3">
          The gap between a project that ships and a project that lasts isn&apos;t the AI. It&apos;s the missing dependency. It&apos;s the human context that no package manager will ever resolve for you. And the sooner we stop treating AI as a replacement for understanding and start treating it as an amplifier of understanding, the better our software is going to be.
        </p>
        <p className="mb-3">
          Install the dependency. Understand what you&apos;re building. The AI will take it from there.
        </p>
      </section>
    </article>
  );
}
