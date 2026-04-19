import { useState, useEffect, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
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

// Dark mode context
export const ThemeContext = createContext();

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <Router>
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
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
    </ThemeContext.Provider>
  );
}

export default App;
