import { useState } from 'react';
import toast from 'react-hot-toast';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import PdfInteractiveViewer from '../components/PdfInteractiveViewer';
import { processFiles } from '../api';

export default function WatermarkPdf() {
  const [files, setFiles] = useState([]);
  const [text, setText] = useState('WATERMARK');
  const [opacity, setOpacity] = useState(0.3);
  const [fontSize, setFontSize] = useState(50);
  const [color, setColor] = useState('#999999');
  const [rotation, setRotation] = useState(0);
  const [applyToAll, setApplyToAll] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [watermarkLocation, setWatermarkLocation] = useState(null);

  const handleProcess = async () => {
    if (files.length === 0) return toast.error('Please upload a PDF file');
    if (!text.trim()) return toast.error('Please enter watermark text');
    if (!watermarkLocation) return toast.error('Please click on the PDF to place your watermark');

    setProcessing(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('text', text);
      formData.append('opacity', opacity.toString());
      formData.append('fontSize', fontSize.toString());
      formData.append('color', color);
      formData.append('rotation', rotation.toString());
      formData.append('applyToAll', applyToAll.toString());
      formData.append('pageIndex', watermarkLocation.pageIndex);
      formData.append('x', watermarkLocation.x);
      formData.append('y', watermarkLocation.y);

      const { blob } = await processFiles('/watermark', formData, setProgress);
      setDownloadUrl(URL.createObjectURL(blob));
      setProgress(100);
      toast.success('Watermark added successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add watermark');
    } finally {
      setProcessing(false);
    }
  };

  const inputStyle = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
  };

  return (
    <ToolLayout title="Add Watermark" description="Add custom text watermark by clicking exactly where you want it" color="#6366f1" icon="💧">
      <FileUpload 
        accept=".pdf" 
        onUpload={(f) => {
          setFiles(f);
          setWatermarkLocation(null);
          setDownloadUrl(null);
        }} 
        label="Drop a PDF file here" 
      />

      {files.length > 0 && (
        <div className="mt-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Watermark Text */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Watermark Text</label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => { setText(e.target.value); setDownloadUrl(null); }}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={inputStyle}
                  placeholder="Enter watermark text"
                />
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Opacity: {Math.round(opacity * 100)}%</label>
                  <input type="range" min="0.05" max="1" step="0.05" value={opacity}
                    onChange={(e) => { setOpacity(parseFloat(e.target.value)); setDownloadUrl(null); }}
                    className="w-full accent-indigo-500" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Rotation: {rotation}°</label>
                  <input type="range" min="0" max="360" step="1" value={rotation}
                    onChange={(e) => { setRotation(parseInt(e.target.value)); setDownloadUrl(null); }}
                    className="w-full accent-indigo-500" />
                </div>



                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Font Size: {fontSize}px</label>
                    <input type="range" min="10" max="150" step="5" value={fontSize}
                      onChange={(e) => { setFontSize(parseInt(e.target.value)); setDownloadUrl(null); }}
                      className="w-full accent-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Color</label>
                    <input type="color" value={color}
                      onChange={(e) => { setColor(e.target.value); setDownloadUrl(null); }}
                      className="w-full h-10 w-10 rounded-xl cursor-pointer" style={{ backgroundColor: 'var(--color-surface)' }} />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>Place Watermark</h3>
              <PdfInteractiveViewer 
                file={files[0]} 
                overlayConfig={{ 
                  type: 'text', 
                  text, 
                  fontSize, 
                  color, 
                  opacity,
                  rotation
                }}
                onPlace={setWatermarkLocation}
              />
            </div>
          </div>
          <div className="flex items-center justify-start gap-2 mb-4 pl-1">
            <input 
              type="checkbox" 
              id="applyToAll" 
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="w-5 h-5 accent-indigo-500 cursor-pointer"
            />
            <label htmlFor="applyToAll" className="text-lg font-bold cursor-pointer" style={{ color: 'var(--color-text)' }}>
              Apply to all pages
            </label>
          </div>
        </div>
      )}

      <ProcessButton
        onClick={handleProcess}
        processing={processing}
        progress={progress}
        downloadUrl={downloadUrl}
        downloadName={files.length > 0 ? files[0].name.replace(/\.[^/.]+$/, "") + "-watermarked.pdf" : "watermarked.pdf"}
        label="Add Watermark"
        disabled={files.length === 0 || !watermarkLocation}
      />
    </ToolLayout>
  );
}

