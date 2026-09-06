import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';

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
  const pdfDocRef = useRef(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [overlayUrl, setOverlayUrl] = useState(null);

  const renderPage = useCallback(async (doc, pageNum) => {
    const page = await doc.getPage(pageNum);
    const renderedViewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    canvas.height = renderedViewport.height;
    canvas.width = renderedViewport.width;
    
    const [x1, y1, x2, y2] = page.view;
    setPageSize({ width: x2 - x1, height: y2 - y1 });

    await page.render({ canvasContext: context, viewport: renderedViewport }).promise;
  }, [scale]);

  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    const loadPdf = async () => {
      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setCurrentPage(1);
        await renderPage(doc, 1);
      } catch (err) {
        console.error('Error loading PDF:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [file, renderPage]);

  useEffect(() => {
    if (overlayConfig?.type === 'image' && overlayConfig.file) {
      const url = URL.createObjectURL(overlayConfig.file);
      setOverlayUrl(url); // eslint-disable-line react-hooks/set-state-in-effect
      return () => URL.revokeObjectURL(url);
    } else {
      setOverlayUrl(null);
    }
  }, [overlayConfig]);

  const handlePageChange = (delta) => {
    const doc = pdfDocRef.current;
    if (!doc) return;
    const newPage = Math.min(Math.max(1, currentPage + delta), numPages);
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
      renderPage(doc, newPage);
    }
  };

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setOverlayPos({ x, y });
    setShowOverlay(true);
    
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
