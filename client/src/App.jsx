import { useState, useEffect, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { AuthProvider } from './AuthContext';
import Home from './pages/Home';
import MergePdf from './pages/MergePdf';
import SplitPdf from './pages/SplitPdf';
import CompressPdf from './pages/CompressPdf';
import PdfToWord from './pages/PdfToWord';
import WordToPdf from './pages/WordToPdf';
import JpgToPdf from './pages/JpgToPdf';
import PdfToJpg from './pages/PdfToJpg';
import RotatePdf from './pages/RotatePdf';
import WatermarkPdf from './pages/WatermarkPdf';
import PageNumbers from './pages/PageNumbers';
import Dashboard from './pages/Dashboard';
import OcrPdf from './pages/OcrPdf';
import FlattenPdf from './pages/FlattenPdf';
import SignPdf from './pages/SignPdf';
import RemoveWatermarkPdf from './pages/RemoveWatermarkPdf';

export const ThemeContext = createContext();

export default function App() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen flex flex-col transition-colors duration-300" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/merge" element={<MergePdf />} />
                <Route path="/split" element={<SplitPdf />} />
                <Route path="/compress" element={<CompressPdf />} />
                <Route path="/pdf-to-word" element={<PdfToWord />} />
                <Route path="/word-to-pdf" element={<WordToPdf />} />
                <Route path="/jpg-to-pdf" element={<JpgToPdf />} />
                <Route path="/pdf-to-jpg" element={<PdfToJpg />} />
                <Route path="/rotate" element={<RotatePdf />} />
                <Route path="/watermark" element={<WatermarkPdf />} />
                <Route path="/page-numbers" element={<PageNumbers />} />
                <Route path="/ocr" element={<OcrPdf />} />
                <Route path="/flatten" element={<FlattenPdf />} />
                <Route path="/sign" element={<SignPdf />} />
                <Route path="/remove-watermark" element={<RemoveWatermarkPdf />} />
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </ThemeContext.Provider>
  );
}
