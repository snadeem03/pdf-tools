import { Link } from 'react-router-dom';

export default function ToolCard({ title, description, icon, path, color, delay = 0 }) {
  return (
    <Link
      to={path}
      className="simple-card p-6 flex flex-col items-center text-center gap-3 cursor-pointer group"
    >
      {/* Icon circle */}
      <div
        className="w-16 h-16 rounded-lg flex items-center justify-center text-3xl"
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
        className="text-sm font-medium mt-auto pt-2"
        style={{ color: 'var(--color-primary)' }}
      >
        Use Tool →
      </span>
    </Link>
  );
}
