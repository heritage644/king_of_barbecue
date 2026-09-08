// Webpack alias stub. `@kob/core` declares job-queue/redis types and constants
// for the API/worker workspaces; the storefront never executes them, so we
// replace these Node-only modules with an empty module in the web bundle.
module.exports = {};
