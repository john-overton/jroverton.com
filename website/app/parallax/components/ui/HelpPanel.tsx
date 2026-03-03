'use client';

export default function HelpPanel() {
  return (
    <div className="mt-3 space-y-6 max-w-3xl">
      {/* Route Editor */}
      <section>
        <h4 className="text-sm font-semibold mb-2">Route Editor</h4>
        <p className="text-xs text-cc-text-secondary mb-2">
          Create and manage the routes that make up your schedule.
        </p>
        <dl className="space-y-1.5 text-xs">
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Adding Routes</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Click <strong>Add Route</strong> to create a new route. Edit the name,
              times, breaks, depot, and service days inline. Service hours are calculated
              automatically from the start/end times minus any breaks.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Splits</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Split a route into segments (e.g. AM/PM pieces) using the split button
              on any row. Naming conventions like <code className="text-[11px] bg-cc-surface-2 px-1 rounded">105a / 105b</code>,{' '}
              <code className="text-[11px] bg-cc-surface-2 px-1 rounded">105-am / 105-pm</code>, or{' '}
              <code className="text-[11px] bg-cc-surface-2 px-1 rounded">105-1 / 105-2</code> are
              detected automatically. Overlapping split times are flagged with a warning.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Depots</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Assign a depot to each route from the dropdown. Depots are configured on the{' '}
              <strong>Import</strong> tab under Depot Settings (extract from route data or add
              manually). Use the depot filter at the top of the editor to narrow the view.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Service Days</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Toggle which days each route operates (M, T, W, Th, F, Sa, Su). Use the
              day filter buttons above the table to show only routes for a specific day.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Stats Row</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; The summary above the table shows the total route count, service hours,
              peak vehicles, productivity, and estimated FTE/PT counts based on the current routes.
            </dd>
          </div>
        </dl>
      </section>

      {/* Understanding the Chart */}
      <section>
        <h4 className="text-sm font-semibold mb-2">Understanding the Chart</h4>
        <p className="text-xs text-cc-text-secondary mb-2">
          The chart above the tabs overlays vehicle coverage on top of demand.
        </p>
        <ul className="space-y-1 text-xs text-cc-text-muted list-none pl-0">
          <li>
            <strong className="text-cc-text-secondary">Bars</strong> &mdash; Demand per time block
            (pickups and active trips on board).
          </li>
          <li>
            <strong className="text-cc-text-secondary">Solid line</strong> &mdash; Vehicles from
            your current imported route data.
          </li>
          <li>
            <strong className="text-cc-text-secondary">Dashed line</strong> &mdash; Vehicles from
            the routes you&rsquo;ve built in the Route Editor.
          </li>
          <li>
            <strong className="text-cc-text-secondary">Dotted line</strong> &mdash; Vehicles for a
            selected date (visible when viewing the Imported Routes tab).
          </li>
          <li>
            <strong className="text-cc-text-secondary">Tooltips</strong> &mdash; Hover over any
            time block to see exact counts, including how many vehicles are on break.
          </li>
        </ul>
        <p className="text-xs text-cc-text-muted mt-1.5">
          Use the <strong>Max / Avg</strong> toggle in the top-right corner to switch between
          peak-day demand and average demand.
        </p>
      </section>

      {/* Filters */}
      <section>
        <h4 className="text-sm font-semibold mb-2">How Filters Affect Data</h4>
        <p className="text-xs text-cc-text-secondary mb-2">
          The filter bar at the top of the page controls what data appears in the chart and tables.
        </p>
        <dl className="space-y-1.5 text-xs">
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Interval</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Sets the time-block size (15, 30, or 60 minutes). Smaller intervals
              give more detail; larger intervals smooth the data.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Depot</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Limits charts and tables to routes belonging to the selected depot.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Day Selection</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Choose day-of-week groups (Weekday, Weekend, individual days) or pick a
              specific date. Demand and vehicle counts update to reflect only the selected days.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Time Range</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Drag the slider handles to narrow the visible time window on charts.
            </dd>
          </div>
        </dl>
      </section>

      {/* Imported Routes */}
      <section>
        <h4 className="text-sm font-semibold mb-2">Imported Routes</h4>
        <p className="text-xs text-cc-text-secondary mb-2">
          View and reuse routes from your imported data so you don&rsquo;t have to build from
          scratch.
        </p>
        <dl className="space-y-1.5 text-xs">
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Select a Date</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Pick a date from the dropdown to see the routes that ran that day.
              The chart adds a dotted line so you can compare that day&rsquo;s coverage against
              demand.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Copy Entire Day</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; First choose which service days should receive the routes using the{' '}
              <strong>Copy to</strong> day selector, then click{' '}
              <strong>Copy Day to Route Editor</strong>. All routes from the selected date are
              added to the Route Editor with the chosen days.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Copy Single Route</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Click the copy icon on any individual route to add just that route to
              the Route Editor. The <strong>Copy to</strong> day selector also applies here.
            </dd>
          </div>
        </dl>
      </section>

      {/* Shift Bids */}
      <section>
        <h4 className="text-sm font-semibold mb-2">Shift Bids</h4>
        <p className="text-xs text-cc-text-secondary mb-2">
          Generate and refine shift bid packages from the routes in your Route Editor.
        </p>
        <dl className="space-y-1.5 text-xs">
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Settings</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Configure FTE hour thresholds, rest hours, max consecutive days, and
              other parameters before generating. Settings lock after generation.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Generate</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Click <strong>Generate Bids</strong> to create bid packages from your
              routes. Packages are ranked and classified as FTE or PT.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Adjust</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Expand a package to see its routes, then drag and drop routes between
              packages. If a move causes a conflict (day overlap, depot mismatch, hour limits), you
              will see a warning before confirming.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Save &amp; Export</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; Changes save automatically. Click <strong>Export Excel</strong> to
              download the bid packages as a spreadsheet.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-cc-text-secondary inline">Regenerate</dt>
            <dd className="text-cc-text-muted inline">
              {' '}&mdash; To start over, click <strong>Regenerate Bids</strong>. You can unlock
              settings to change parameters, or regenerate immediately. This discards all manual
              adjustments.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
