import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';

// Set worker path
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfSignViewer({ file, signature, onPlace }) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [sigPos, setSigPos] = useState({ x: 50, y: 50 });
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!file) return;

    const loadPdf = async () => {
      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        renderPage(doc, 1);
      } catch (err) {
        console.error('Error loading PDF:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [file]);

  const renderPage = async (doc, pageNum) => {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    setPageSize({ width: viewport.width, height: viewport.height });

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    await page.render(renderContext).promise;
  };

  const handlePageChange = (delta) => {
    const newPage = Math.min(Math.max(1, currentPage + delta), numPages);
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
      renderPage(pdfDoc, newPage);
    }
  };

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // We want to center the signature on click (visual feedback)
    setSigPos({ x, y });
    
    // Convert to PDF units (points)
    // pdfjs viewport scale is 1.5
    // so 1.5 viewport units = 1 PDF point? No, viewport.width = pointWidth * scale
    // so points = viewportUnits / scale
    const scale = 1.5;
    const clickXPoints = (x * (pageSize.width / rect.width)) / scale;
    const clickYPoints = (y * (pageSize.height / rect.height)) / scale;
    
    // pdf-lib origin is bottom-left
    const pdfPageHeightPoints = pageSize.height / scale;

    onPlace({
      pageIndex: currentPage - 1,
      x: clickXPoints,
      y: pdfPageHeightPoints - clickYPoints,
    });
  };


  const [sigUrl, setSigUrl] = useState(null);

  useEffect(() => {
    if (signature) {
      const url = URL.createObjectURL(signature);
      setSigUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [signature]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-xl bg-opacity-5 bg-white border-white/20">
      <div className="flex items-center gap-4 mb-2">
        <button 
          onClick={() => handlePageChange(-1)} 
          disabled={currentPage <= 1}
          className="p-2 bg-white/10 rounded disabled:opacity-30"
        >
          Previous
        </button>
        <span>Page {currentPage} of {numPages}</span>
        <button 
          onClick={() => handlePageChange(1)} 
          disabled={currentPage >= numPages}
          className="p-2 bg-white/10 rounded disabled:opacity-30"
        >
          Next
        </button>
      </div>

      <div 
        className="relative shadow-2xl cursor-crosshair overflow-hidden rounded"
        style={{ width: 'fit-content' }}
        onClick={handleCanvasClick}
      >
        <canvas ref={canvasRef} className="max-w-full h-auto" />
        
        {sigUrl && (
          <div 
            className="absolute pointer-events-none transition-all duration-200"
            style={{
              left: `${sigPos.x}px`,
              top: `${sigPos.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <img 
              src={sigUrl} 
              alt="signature preview" 
              className="max-w-[150px] opacity-70 border-2 border-dashed border-blue-500"
            />
          </div>
        )}
      </div>


      {loading && <div className="text-sm opacity-60">Loading document...</div>}
      <div className="text-xs opacity-40 mt-2 italic text-center">
        Click on the document to place your signature where you want it.
      </div>
    </div>
  );
}
