import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ThemeContext } from '../App';

export default function Navbar() {
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div
              className="w-9 h-9 rounded flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              PDF
            </div>
            <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
              PDF <span style={{ color: 'var(--color-primary)' }}>Tools</span>
            </span>
          </Link>

          {/* Right: Nav + Dark Mode */}
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-sm font-medium px-3 py-2 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: 'var(--color-text)' }}
            >
              All Tools
            </Link>

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                backgroundColor: darkMode ? 'var(--color-primary)' : '#cbd5e1',
                focusRingColor: 'var(--color-primary)',
              }}
              aria-label="Toggle dark mode"
            >
              <span
                className="absolute top-0.5 w-6 h-6 rounded-full shadow-md transition-transform duration-300 flex items-center justify-center text-xs"
                style={{
                  backgroundColor: 'white',
                  transform: darkMode ? 'translateX(30px)' : 'translateX(2px)',
                }}
              >
                {darkMode ? '🌙' : '☀️'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
