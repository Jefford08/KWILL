// Wraps an async Express route handler so a rejected promise (e.g. Postgres
// rejecting a bad date) is forwarded to Express's error-handling middleware
// instead of crashing the process. Express 4 does not do this automatically
// for async functions.
function wrap(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = wrap;
