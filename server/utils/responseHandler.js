/**
 * Handles the final download response.
 *
 * Note: History logging for authenticated users happens centrally in
 * utils/historyTracker.js, which wraps express.response.download for every
 * route. This function used to *also* create a History row itself, which
 * meant every call site using sendDownloadResponse (OCR, Sign) logged two
 * History rows per operation instead of one. Don't add logging here again -
 * historyTracker.js is the single source of truth.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} filePath - path to the file to send
 * @param {string} downloadName - filename presented to the client
 * @param {string} toolName - kept for call-site clarity / future use; actual
 *   logging derives the tool name from the request URL in historyTracker.js
 * @param {(err: Error|null) => void} [cleanupCallback] - invoked after the
 *   download finishes (or fails) so callers can clean up temp files exactly
 *   once, instead of relying solely on the periodic cleanup cron.
 */
exports.sendDownloadResponse = (req, res, filePath, downloadName, toolName, cleanupCallback) => {
  res.download(filePath, downloadName, (err) => {
    if (err) {
      console.error(`Download error for ${toolName}:`, err.message);
    }
    if (typeof cleanupCallback === 'function') {
      cleanupCallback(err);
    }
  });
};
