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
          className="w-full py-4 rounded-2xl text-white font-semibold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: disabled || processing
              ? '#94a3b8'
              : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
            boxShadow: disabled || processing ? 'none' : '0 8px 25px rgba(79, 70, 229, 0.3)',
          }}
          onMouseEnter={(e) => {
            if (!disabled && !processing) e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; }}
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
        <div className="progress-bar">
          <div className="progress-bar-fill animate-shimmer" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Download Button */}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download={downloadName}
          className="block w-full py-4 rounded-2xl text-white font-semibold text-lg text-center transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, #10b981, #34d399)',
            boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)',
          }}
          onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; }}
        >
          ⬇ Download Result
        </a>
      )}
    </div>
  );
}
