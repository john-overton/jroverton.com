# The Plan is Never the Whole Picture: Iterating Through Development with AI

Software is a living thing. It grows, it changes, it adjusts to the needs of the people using it. And no matter how detailed your plan is upfront, you're going to find gaps. That's not a failure of planning. That's just how building software works.

I've been building products with AI assistance for a while now, and the process I've landed on starts the same way every time: a plan. Not a loose idea, but a real plan. Architecture decisions, security considerations, technical documentation, and context files that map out where specific logic lives in the codebase. I treat these documents as the foundation for everything that follows. The better the plan, the better the AI output, and the faster I can move.

When I say context files, I mean the actual files. The code that needs to be modified, the documentation that describes how the system works, the schema definitions. I'm handing the AI the real source files and explaining explicitly what needs to change. It's knowing your codebase well enough to point the AI at the right files and say "here's the logic, here's what needs to happen." That's what turns AI from a generic code generator into something that can make surgical changes to your project.

But here's the thing: even a detailed plan doesn't catch every edge case. It can't. Edge cases come from experience and testing. They come from actually using the product and watching other people use it. You can architect the perfect system on paper, write comprehensive specs, map out every API endpoint and data model, and you will still miss things. That's not a flaw in the process. That's the process.

There are two kinds of testing that surface these gaps. The first is actual code tests. Unit tests, integration tests, end to end tests. These catch the technical edge cases: the null values you didn't account for, the race conditions, the boundary scenarios. The second is user experience testing. This is where you or someone else sits down and actually uses the thing you built. And this is where the real surprises show up.

I'll give you a real example from my project Sprout Track, a baby activity tracker I built for my family.

We implemented push notifications so caregivers could stay informed about what was happening with the baby. The plan was solid: users subscribe to notifications, the server detects when an activity is logged or a timer expires, and it sends a push notification to all subscribed devices. We documented the schema, the VAPID key setup, the subscription management, the notification dispatch flow. It was a thorough plan.

Built it out. Tested it. Notifications were firing correctly. Everything worked as designed. I moved on.

Then one morning it hit me. Wait. The user who logs the activity isn't supposed to get a notification for it. They already know. They just did it. The whole point of the notifications is to inform everyone else. The plan said "notify subscribed users when an activity is created." It did exactly that. The logic was correct. It just wasn't smart enough yet.

So I had to go back and add logic to exclude the user who performed the action from receiving the notification for that action. Simple fix in hindsight. But that's the point: sometimes the edge cases don't jump out during testing. Everything passes, everything works, and then your brain catches up later and you realize there's a gap between "working as coded" and "working as intended."

This is the iteration loop that makes software actually good. Plan, build, test, use, discover, adjust. Repeat. The initial plan gets you 80% of the way there. The remaining 20% comes from grinding through real world usage and being willing to go back and refine.

When you're building with AI, this loop is faster than ever. I can identify an edge case, describe the problem with the right context, and have a solution implemented in minutes instead of hours. The AI already understands the codebase because I've been feeding it context from the start. It knows the notification system, the schema, the subscription flow. So when I say "add logic to prevent the user who created the activity from receiving the push notification," it can make that change surgically because the documentation is already there.

This is why I keep hammering on the importance of documentation and context. It's not just for the initial build. It's for every iteration that follows. Every edge case you fix, every feature you adjust, every behavior you refine. The documentation evolves with the product. When AI updates the code, I have it update the docs too. That creates a feedback loop where better documentation leads to better AI output, which leads to better code, which leads to better documentation.

Software is never done. The best products are the ones that keep evolving based on how people actually use them. The plan is critical, but it's just the starting point. The real work happens in the iterations that follow.
