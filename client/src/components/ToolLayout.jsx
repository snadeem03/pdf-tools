/**
 * Reusable wrapper for each tool page layout.
 * Provides consistent header, back button, and centered content.
 */
import { Link } from 'react-router-dom';

export default function ToolLayout({ title, description, color, icon, children }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium mb-8 hover:underline"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        ← Back to all tools
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-14 h-14 rounded flex items-center justify-center text-2xl"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          {icon}
        </div>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{title}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>
        </div>
      </div>

      {/* Content */}
      <div className="simple-card p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
