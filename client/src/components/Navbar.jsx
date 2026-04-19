import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ThemeContext } from '../App';

export default function Navbar() {
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);

  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-xl border-b transition-all duration-300"
      style={{
        backgroundColor: darkMode ? 'rgba(15, 23, 42, 0.75)' : 'rgba(248, 250, 252, 0.75)',
        borderColor: darkMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(79, 70, 229, 0.1)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))' }}
            >
              PDF
            </div>
            <span className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--color-text)' }}>
              PDF <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))' }}>Tools</span>
            </span>
          </Link>

          {/* Right: Nav + Dark Mode */}
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-300"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.target.style.color = 'var(--color-primary)';
                e.target.style.backgroundColor = darkMode ? 'rgba(245,158,11,0.1)' : 'rgba(79,70,229,0.05)';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = 'var(--color-text-secondary)';
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              All Tools
            </Link>

            {/* Dark mode toggle with glow effect in dark mode */}
            <button
              onClick={toggleDarkMode}
              className={`relative w-16 h-8 rounded-full transition-all duration-500 focus:outline-none shadow-inner ${darkMode ? 'shadow-[0_0_15px_rgba(245,158,11,0.3)]' : ''}`}
              style={{
                backgroundColor: darkMode ? 'var(--color-primary-dark)' : '#cbd5e1',
              }}
              aria-label="Toggle dark mode"
            >
              <span
                className="absolute top-1 w-6 h-6 rounded-full shadow-md transition-all duration-500 flex items-center justify-center text-xs"
                style={{
                  backgroundColor: 'white',
                  transform: darkMode ? 'translateX(34px) rotate(360deg)' : 'translateX(4px) rotate(0deg)',
                  boxShadow: darkMode ? '0 0 10px rgba(245,158,11,0.8)' : '0 2px 5px rgba(0,0,0,0.2)',
                }}
              >
                {darkMode ? '✨' : '☀️'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
