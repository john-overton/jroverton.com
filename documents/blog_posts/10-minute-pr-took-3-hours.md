# The 10-Minute PR That Took 3 Hours

A contributor submitted a pull request to Sprout Track recently. They wanted to add breast milk storage tracking, and I was grateful for the contribution. The implementation was clean and logical: log stored breast milk, show the amount.

What appeared to be a 10-minute merge ended up being a 3-hour coding session once I started reviewing the implementation and thinking about how it should really work and why.

## What "Complete" Actually Looks Like

The original implementation handled the straightforward case. But Sprout Track has existing users, established patterns, and layers of functionality that all have to stay in sync.

Here's what the 3 hours looked like:

Historical data capture. Users who've been pumping and storing for weeks or months need a way to backfill. That means an adjustment flow, a way to set a baseline for people already deep into their routines.

Mixed feed types. Some parents bottle-feed expressed breast milk. Some mix formula and breast milk. The storage feature has to understand that "breast milk" shows up in multiple contexts, and each one affects the stored amount differently.

Recursive reporting. If a parent stores 10 ounces on Monday and consumes 4 on Tuesday, the report needs to show 6 remaining. Consumption can come from bottles logged across multiple days, adjustments can modify historical totals, and the daily view needs to reflect the running balance accurately.

Daily stats integration. The current stored amount needs to surface in the daily summary view without cluttering the layout or breaking the existing hierarchy of information.

Theming and context. Every new UI element has to respect the app's theming system. Colors, spacing, typography, all of it.

Translations. Every new string, label, and status message needs translation entries for all supported languages.

None of this was visible from the outside. And that's the point.

## Two Kinds of Complexity

There's a useful distinction here between technical complexity and UX complexity. They overlap, but they pull in different directions.

Technical complexity is the stuff under the hood. Recursive calculations, data model decisions that ripple into reporting, migration paths for existing users, edge cases in how different feed types interact. Getting this wrong produces numbers that parents rely on to make decisions about feeding their child.

UX complexity is about whether the feature makes sense to the person using it. Does the adjustment flow feel intuitive? Does the daily stats view still scan quickly with the new information? Does the storage tracker feel like it belongs in the app?

Both require context. You can't solve either one by looking at the feature in isolation.

## The Missing Layer: Defined Considerations

Every project past a certain size carries a set of invisible constraints. Things that any new feature has to pass through before it ships. Not a heavy process document. Not a gate review. Just the stuff you check automatically because you've lived in the codebase long enough to know where the landmines are.

For Sprout Track, those considerations look something like: Does it handle existing users with historical data? Does it respect theming? Are translations covered? Does it integrate cleanly with the daily stats view? Does the reporting logic account for consumption against storage? Does it handle mixed feed types?

Right now, that list lives in my head. I don't have it written down. That's a problem, because it means every contributor has to either guess at the constraints or submit something incomplete and wait for me to catch what's missing. That's not a fair setup for anyone.

Defining those considerations explicitly is the next step. Not as bureaucracy. As architecture documentation. A short, living list that says: here's what every new feature in this project needs to account for. If the constraints only exist in your head, no one can meet them. Not a contributor. Not even a future version of yourself coming back to the project after a few months away.

## People Don't Know What They Don't Know

The contributor who submitted that PR did good work. They built something that functioned for the use case they understood. The gap wasn't effort or skill. It was visibility. They couldn't account for constraints they didn't know existed, and there was no documentation telling them what to look for. That's on me.