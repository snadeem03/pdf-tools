import { Link } from 'react-router-dom';

export default function ToolCard({ title, description, icon, path, color, delay = 0 }) {
  return (
    <Link
      to={path}
      className="glass-card p-8 flex flex-col items-center text-center gap-4 cursor-pointer animate-fade-in-up group relative overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Background glow in dark mode */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity duration-500 rounded-16 z-0"
           style={{ background: `radial-gradient(circle at center, var(--color-primary) 0%, transparent 70%)` }} />

      {/* Icon circle */}
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 z-10"
        style={{ background: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)`, color: 'white' }}
      >
        {icon}
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold mt-2 z-10 transition-colors duration-300 group-hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text)' }}>
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm leading-relaxed z-10" style={{ color: 'var(--color-text-secondary)' }}>
        {description}
      </p>

      {/* Arrow indicator */}
      <span
        className="text-sm font-bold mt-auto pt-4 flex items-center gap-2 opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-10"
        style={{ color: 'var(--color-primary)' }}
      >
        Use Tool <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
      </span>
    </Link>
  );
}
