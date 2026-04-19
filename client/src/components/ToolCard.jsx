import { Link } from 'react-router-dom';

export default function ToolCard({ title, description, icon, path, color, delay = 0 }) {
  return (
    <Link
      to={path}
      className="glass-card p-6 flex flex-col items-center text-center gap-3 cursor-pointer animate-fade-in-up group"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Icon circle */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-lg transition-transform duration-300 group-hover:scale-110"
        style={{ background: `linear-gradient(135deg, ${color}20, ${color}40)` }}
      >
        {icon}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        {description}
      </p>

      {/* Arrow indicator */}
      <span
        className="text-xs font-medium mt-auto pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ color: color }}
      >
        Use Tool →
      </span>
    </Link>
  );
}
