const logger = require('./logger');

/**
 * Fallback wrapper: tries primary function, then fallback on failure.
 * @param {Function} primaryFn - async function to try first
 * @param {Function} fallbackFn - async function to try if primary fails
 * @param {string} operationName - name for logging
 * @returns {Promise<any>} result from whichever function succeeds
 */
async function withFallback(primaryFn, fallbackFn, operationName = 'operation') {
  try {
    logger.info(`[${operationName}] Attempting primary method...`);
    const result = await primaryFn();
    logger.info(`[${operationName}] Primary method succeeded`);
    return result;
  } catch (primaryError) {
    logger.warn(`[${operationName}] Primary method failed: ${primaryError.message}`);

    if (fallbackFn) {
      try {
        logger.info(`[${operationName}] Attempting fallback method...`);
        const result = await fallbackFn();
        logger.info(`[${operationName}] Fallback method succeeded`);
        return result;
      } catch (fallbackError) {
        logger.error(`[${operationName}] Fallback also failed: ${fallbackError.message}`);
        throw new Error(
          `Both primary and fallback failed for ${operationName}. ` +
          `Primary: ${primaryError.message}. Fallback: ${fallbackError.message}`
        );
      }
    }

    throw primaryError;
  }
}

module.exports = { withFallback };
