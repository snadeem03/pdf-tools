import { useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import api from '../api';

export default function Dashboard() {
  const { user, loading } = useContext(AuthContext);
  const [history, setHistory] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (user) {
      api.get('/auth/history')
        .then(res => setHistory(res.data))
        .catch(err => console.error(err))
        .finally(() => setFetching(false));
    }
  }, [user]);

  if (loading) return <div className="p-20 text-center">Loading authentication...</div>;
  if (!user) return <Navigate to="/" replace />; // Guard

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="glass-card p-10 mb-10 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)] rounded-full mix-blend-multiply opacity-10 filter blur-[80px]" />
        <h1 className="text-4xl font-extrabold mb-2" style={{ color: 'var(--color-text)' }}>Welcome back, {user.name}!</h1>
        <p className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>{user.email}</p>
      </div>

      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text)' }}>Your Conversion History</h2>
      
      {fetching ? (
        <div className="text-center p-10">Loading history...</div>
      ) : history.length === 0 ? (
        <div className="glass-card p-12 text-center text-lg" style={{ color: 'var(--color-text-secondary)' }}>
          You haven't processed any PDF files yet. Try one of our tools to see them appear here!
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ backgroundColor: 'rgba(var(--color-primary-rgb), 0.05)', color: 'var(--color-text-secondary)' }}>
                  <th className="px-6 py-4 font-semibold uppercase text-xs">Tool Used</th>
                  <th className="px-6 py-4 font-semibold uppercase text-xs">File Name</th>
                  <th className="px-6 py-4 font-semibold uppercase text-xs">File Size</th>
                  <th className="px-6 py-4 font-semibold uppercase text-xs">Date</th>
                  <th className="px-6 py-4 font-semibold uppercase text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {history.map((record) => (
                  <tr key={record.id} className="transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.02)]">
                    <td className="px-6 py-4 font-bold" style={{ color: 'var(--color-text)' }}>
                      <span className="px-3 py-1 bg-[rgba(var(--color-primary-rgb),0.1)] text-[var(--color-primary)] rounded-full text-xs uppercase">{record.toolName}</span>
                    </td>
                    <td className="px-6 py-4 truncate max-w-xs font-medium" style={{ color: 'var(--color-text)' }}>{record.fileName}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {record.fileSize ? (record.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {new Date(record.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {record.status === 'success' ? (
                        <span className="text-green-500 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Success</span>
                      ) : (
                        <span className="text-red-500 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Failed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
