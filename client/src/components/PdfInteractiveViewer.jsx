import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';

// Set worker path
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfInteractiveViewer({ 
  file, 
  overlayConfig, 
  onPlace,
  scale = 1.5
}) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [overlayPos, setOverlayPos] = useState({ x: 0, y: 0 });
  const [showOverlay, setShowOverlay] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [overlayUrl, setOverlayUrl] = useState(null);

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

  useEffect(() => {
    if (overlayConfig?.type === 'image' && overlayConfig.file) {
      const url = URL.createObjectURL(overlayConfig.file);
      setOverlayUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOverlayUrl(null);
    }
  }, [overlayConfig]);

  const renderPage = async (doc, pageNum) => {
    const page = await doc.getPage(pageNum);
    const renderedViewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    canvas.height = renderedViewport.height;
    canvas.width = renderedViewport.width;
    
    // Store original PDF points
    const [x1, y1, x2, y2] = page.view;
    setPageSize({ width: x2 - x1, height: y2 - y1 });

    const renderContext = {
      canvasContext: context,
      viewport: renderedViewport,
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
    
    setOverlayPos({ x, y });
    setShowOverlay(true);
    
    // Normalize to PDF points
    // Since we set the container width to pageSize.width, 
    // the ratio between CSS pixels and PDF points is 1:1.
    const clickXPoints = x * (pageSize.width / rect.width);
    const clickYPoints = y * (pageSize.height / rect.height);

    onPlace({
      pageIndex: currentPage - 1,
      x: clickXPoints,
      y: pageSize.height - clickYPoints,
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-xl bg-opacity-5 bg-white border-white/20">
      <div className="flex items-center gap-4 mb-2">
        <button 
          onClick={(e) => { e.preventDefault(); handlePageChange(-1); }} 
          disabled={currentPage <= 1}
          className="p-2 bg-white/10 rounded-lg disabled:opacity-30 hover:bg-white/20 transition-colors"
        >
          Previous
        </button>
        <span className="text-sm font-medium">Page {currentPage} of {numPages}</span>
        <button 
          onClick={(e) => { e.preventDefault(); handlePageChange(1); }} 
          disabled={currentPage >= numPages}
          className="p-2 bg-white/10 rounded-lg disabled:opacity-30 hover:bg-white/20 transition-colors"
        >
          Next
        </button>
      </div>

      <div 
        className="relative shadow-2xl cursor-crosshair overflow-hidden rounded-xl border border-white/10"
        style={{ 
          width: '100%',
          maxWidth: pageSize.width ? `${pageSize.width}px` : '100%',
          aspectRatio: pageSize.width ? `${pageSize.width} / ${pageSize.height}` : 'auto',
          margin: '0 auto'
        }}
        onClick={handleCanvasClick}
      >
        <canvas 
          ref={canvasRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            display: 'block'
          }} 
        />

        
        {showOverlay && (
          <div 
            className="absolute pointer-events-none transition-all duration-200"
            style={{
              left: `${overlayPos.x}px`,
              top: `${overlayPos.y}px`,
              transform: `translate(-50%, -50%) rotate(${overlayConfig.rotation || 0}deg)`,
              transformOrigin: 'center center',
            }}
          >
            {overlayConfig.type === 'image' && overlayUrl ? (
              <img 
                src={overlayUrl} 
                alt="overlay preview" 
                className="max-w-[150px] opacity-70 border-2 border-dashed border-primary"
              />
            ) : overlayConfig.type === 'text' ? (
              <div 
                style={{
                  color: overlayConfig.color || '#000000',
                  fontSize: `${overlayConfig.fontSize || 30}px`,
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  opacity: overlayConfig.opacity || 0.5,
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  lineHeight: '1',
                  outline: '1px dashed #6366f1',
                  padding: '0',
                }}
              >
                {overlayConfig.text || 'Watermark'}
              </div>

            ) : null}

          </div>
        )}

      </div>

      {loading && <div className="text-sm opacity-60 animate-pulse">Loading document...</div>}
      <div className="text-xs opacity-40 mt-2 italic text-center">
        Click on the document to place the {overlayConfig.type === 'image' ? 'signature' : 'watermark'}.
      </div>
    </div>
  );
}
