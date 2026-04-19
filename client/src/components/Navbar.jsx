import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThemeContext } from '../App';
import { AuthContext } from '../AuthContext';
import AuthModal from './AuthModal';

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const { user, logout } = useContext(AuthContext);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-[100] border-b transition-colors duration-300"
      style={{
        backgroundColor: darkMode ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        borderColor: 'var(--color-border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg transition-transform group-hover:scale-105"
                 style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}>
              PDF
            </div>
            <span className="text-2xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
              iLove<span style={{ color: 'var(--color-primary)' }}>PDF</span> Clone
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="font-semibold hover:opacity-75 transition-opacity" style={{ color: 'var(--color-text)' }}>
              {t('app.allTools', 'All Tools')}
            </Link>

            {user ? (
              <div className="flex items-center gap-4 relative group">
                <Link to="/dashboard" className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-md cursor-pointer transition-transform hover:scale-105"
                       style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </Link>
                <button onClick={logout} className="text-sm font-semibold hover:text-red-500 transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('app.logout', 'Logout')}
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="text-sm font-bold px-4 py-2 rounded-xl text-white shadow-md transition-transform hover:scale-105"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
              >
                {t('app.login', 'Login / Sign Up')}
              </button>
            )}

            {/* Language Switcher */}
            <select 
              value={i18n.language} 
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="bg-transparent border rounded p-1 text-sm outline-none cursor-pointer"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="hi">हिंदी</option>
            </select>

            {/* Dark mode toggle with glow effect in dark mode */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full transition-all duration-300 relative group"
              style={{
                backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                color: darkMode ? '#fbbf24' : 'var(--color-text)',
                boxShadow: darkMode ? '0 0 15px rgba(251, 191, 36, 0.5)' : 'none'
              }}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </nav>
  );
}
