import { Link } from 'react-router-dom';

export default function ToolLayout({ title, description, icon, children }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">
      {/* Background glow specific to the tool page */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl h-64 bg-[var(--color-primary)] rounded-full mix-blend-multiply filter blur-[100px] opacity-10 pointer-events-none -z-10"></div>

      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-bold mb-10 transition-all hover:-translate-x-1"
        style={{ color: 'var(--color-text-secondary)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
      >
        <span className="text-lg">←</span> Back to all tools
      </Link>

      {/* Header */}
      <div className="flex items-center gap-6 mb-12 animate-fade-in-up">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-2xl relative group"
          style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))` }}
        >
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 rounded-3xl transition-opacity duration-300"></div>
          <span className="relative z-10 text-white drop-shadow-md">{icon}</span>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--color-text)' }}>{title}</h1>
          <p className="text-lg mt-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>
        </div>
      </div>

      {/* Content strictly in glass card */}
      <div className="animate-fade-in-up glass-card p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(245,158,11,0.1)]" style={{ animationDelay: '100ms' }}>
        {children}
      </div>
    </div>
  );
}
