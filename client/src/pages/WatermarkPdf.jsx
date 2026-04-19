import { useState } from 'react';
import toast from 'react-hot-toast';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import { processFiles } from '../api';

const POSITIONS = [
  { value: 'center', label: 'Center' },
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

export default function WatermarkPdf() {
  const [files, setFiles] = useState([]);
  const [text, setText] = useState('WATERMARK');
  const [position, setPosition] = useState('center');
  const [opacity, setOpacity] = useState(0.3);
  const [fontSize, setFontSize] = useState(50);
  const [color, setColor] = useState('#999999');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleProcess = async () => {
    if (files.length === 0) return toast.error('Please upload a PDF file');
    if (!text.trim()) return toast.error('Please enter watermark text');
    setProcessing(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('text', text);
      formData.append('position', position);
      formData.append('opacity', opacity.toString());
      formData.append('fontSize', fontSize.toString());
      formData.append('color', color);

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
    <ToolLayout title="Add Watermark" description="Add custom text watermark to your PDF pages" color="#6366f1" icon="💧">
      <FileUpload accept=".pdf" onUpload={setFiles} label="Drop a PDF file here" />

      {files.length > 0 && (
        <div className="mt-6 space-y-5">
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

          {/* Position */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Position</label>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setPosition(p.value); setDownloadUrl(null); }}
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    backgroundColor: position === p.value ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: position === p.value ? 'white' : 'var(--color-text)',
                    border: `1px solid ${position === p.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Opacity: {Math.round(opacity * 100)}%</label>
              <input type="range" min="0.05" max="1" step="0.05" value={opacity}
                onChange={(e) => { setOpacity(parseFloat(e.target.value)); setDownloadUrl(null); }}
                className="w-full accent-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Font Size: {fontSize}px</label>
              <input type="range" min="10" max="150" step="5" value={fontSize}
                onChange={(e) => { setFontSize(parseInt(e.target.value)); setDownloadUrl(null); }}
                className="w-full accent-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Color</label>
              <input type="color" value={color}
                onChange={(e) => { setColor(e.target.value); setDownloadUrl(null); }}
                className="w-full h-10 rounded-xl cursor-pointer" style={{ backgroundColor: 'var(--color-surface)' }} />
            </div>
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
        disabled={files.length === 0}
      />
    </ToolLayout>
  );
}
