/**
 * Shared processing button, progress bar, and download UI.
 */
export default function ProcessButton({ onClick, processing, progress, downloadUrl, downloadName, label = 'Process', disabled = false }) {
  return (
    <div className="mt-6 space-y-4">
      {/* Action Button */}
      {!downloadUrl && (
        <button
          onClick={onClick}
          disabled={disabled || processing}
          className="w-full py-4 rounded font-semibold text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'white',
          }}
        >
          {processing ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : label}
        </button>
      )}

      {/* Progress Bar */}
      {processing && (
        <div className="progress-bar mt-2">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Download Button */}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download={downloadName}
          className="block w-full py-4 rounded font-semibold text-lg text-center hover:opacity-90"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'white',
          }}
        >
          Download Result
        </a>
      )}
    </div>
  );
}
