export default function ProcessButton({ onClick, disabled, processing, progress, downloadUrl, downloadName }) {
  return (
    <div className="mt-8 transition-all duration-300">
      {!downloadUrl && (
        <button
          onClick={onClick}
          disabled={disabled || processing}
          className="relative w-full py-5 rounded-2xl text-white font-bold text-xl transition-all duration-500 disabled:opacity-60 disabled:cursor-not-allowed group overflow-hidden"
          style={{
            background: disabled || processing
              ? 'var(--color-border)'
              : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
            boxShadow: disabled || processing ? 'none' : '0 10px 30px -5px rgba(var(--color-primary-rgb), 0.5)',
          }}
          onMouseEnter={(e) => {
            if (!disabled && !processing) e.currentTarget.style.transform = 'translateY(-3px)';
          }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {processing ? (
            <span className="flex items-center justify-center gap-3 relative z-10">
              <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : (
            <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-md">
              Apply Changes <span className="group-hover:translate-x-1 transition-transform">→</span>
            </span>
          )}
          {/* Shine effect over the button */}
          {!disabled && !processing && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 transform -translate-x-full group-hover:animate-shimmer transition-transform" />
          )}
        </button>
      )}

      {/* Progress Bar */}
      {processing && (
        <div className="progress-bar mt-6 shadow-inner">
          <div className="progress-bar-fill animate-shimmer" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Download Button */}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download={downloadName}
          className="relative block w-full py-5 rounded-2xl text-white font-bold text-xl text-center transition-all duration-500 overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            boxShadow: '0 10px 30px -5px rgba(16, 185, 129, 0.5)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-md">
            <svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download Result
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 transform -translate-x-full group-hover:animate-shimmer transition-transform" />
        </a>
      )}
    </div>
  );
}
