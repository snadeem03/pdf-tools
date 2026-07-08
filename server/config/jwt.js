const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Resolves the JWT signing secret.
 *
 * - In production, JWT_SECRET MUST be set via environment variable. The process
 *   exits immediately if it's missing, rather than silently falling back to a
 *   publicly-known default (which would let anyone forge valid auth tokens).
 * - In development, if JWT_SECRET isn't set, we generate a random secret for
 *   this process only (tokens won't survive a restart, which is fine for local
 *   dev) and log a loud warning so it doesn't get missed.
 */
function resolveJwtSecret() {
  const configured = process.env.JWT_SECRET;

  if (configured && configured.trim().length > 0) {
    if (configured.length < 32) {
      logger.warn(
        'JWT_SECRET is set but is shorter than 32 characters. Consider using a longer, random value ' +
        '(e.g. `openssl rand -hex 32`) for better security.'
      );
    }
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    // Fail fast: never run production with a guessable/default secret.
    logger.error('FATAL: JWT_SECRET is not set. Refusing to start in production without it.');
    // eslint-disable-next-line no-console
    console.error(
      '\nFATAL: JWT_SECRET environment variable is required in production.\n' +
      'Generate one with: openssl rand -hex 32\n'
    );
    process.exit(1);
  }

  const ephemeralSecret = crypto.randomBytes(32).toString('hex');
  logger.warn(
    'JWT_SECRET is not set. Using a randomly generated development-only secret. ' +
    'Existing tokens will be invalidated on every restart. Set JWT_SECRET in your .env for persistent sessions.'
  );
  return ephemeralSecret;
}

const JWT_SECRET = resolveJwtSecret();

module.exports = { JWT_SECRET };
