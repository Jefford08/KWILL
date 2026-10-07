const crypto = require('crypto');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}


function attachToken(req, res, next) {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session ? req.session.csrfToken : null;
  next();
}

function verifyToken(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();
  const sessionToken = req.session && req.session.csrfToken;
  const submittedToken = req.body && req.body._csrf;
  if (!safeEqual(sessionToken, submittedToken)) {
    return res.status(403).render('error', {
      title: 'Request blocked',
      message: 'Your session expired or the form was out of date. Please go back and try again.',
    });
  }
  next();
}

module.exports = { attachToken, verifyToken };
