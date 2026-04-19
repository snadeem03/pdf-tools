import { useState, useContext } from 'react';
import { AuthContext } from '../AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.name, formData.email, formData.password);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-8 relative animate-fade-in-up">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-red-500 text-2xl font-bold">×</button>
        
        <h2 className="text-3xl font-bold mb-6 text-center" style={{ color: 'var(--color-text)' }}>
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        {error && <div className="p-3 mb-4 text-sm text-red-500 bg-red-100 dark:bg-red-900/30 rounded border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Full Name</label>
              <input type="text" name="name" required value={formData.name} onChange={handleChange}
                     className="w-full p-3 rounded-xl border bg-transparent outline-none focus:border-[var(--color-primary)] transition-all"
                     style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Email Address</label>
            <input type="email" name="email" required value={formData.email} onChange={handleChange}
                   className="w-full p-3 rounded-xl border bg-transparent outline-none focus:border-[var(--color-primary)] transition-all"
                   style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Password</label>
            <input type="password" name="password" required value={formData.password} onChange={handleChange} minLength="6"
                   className="w-full p-3 rounded-xl border bg-transparent outline-none focus:border-[var(--color-primary)] transition-all"
                   style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          </div>
          
          <button type="submit" disabled={loading}
                  className="mt-4 w-full py-3 rounded-xl text-white font-bold transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}>
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>
            {isLogin ? 'Sign up here' : 'Login here'}
          </button>
        </p>
      </div>
    </div>
  );
}
