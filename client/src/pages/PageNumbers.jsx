import { useState } from 'react';
import toast from 'react-hot-toast';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import { processFiles } from '../api';

const POSITIONS = [
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
];

const FORMATS = [
  { value: 'numeric', label: '1, 2, 3...' },
  { value: 'roman', label: 'I, II, III...' },
  { value: 'dash', label: '- 1 -, - 2 -...' },
];

export default function PageNumbers() {
  const [files, setFiles] = useState([]);
  const [position, setPosition] = useState('bottom-center');
  const [format, setFormat] = useState('numeric');
  const [startFrom, setStartFrom] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleProcess = async () => {
    if (files.length === 0) return toast.error('Please upload a PDF file');
    setProcessing(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('position', position);
      formData.append('format', format);
      formData.append('startFrom', startFrom.toString());
      formData.append('fontSize', fontSize.toString());

      const { blob } = await processFiles('/page-numbers', formData, setProgress);
      setDownloadUrl(URL.createObjectURL(blob));
      setProgress(100);
      toast.success('Page numbers added!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add page numbers');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolLayout title="Page Numbers" description="Add page numbers to your PDF document" color="#9333ea" icon="🔢">
      <FileUpload accept=".pdf" onUpload={setFiles} label="Drop a PDF file here" />

      {files.length > 0 && (
        <div className="mt-6 space-y-5">
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

          {/* Format */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Number Format</label>
            <div className="flex gap-3">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setFormat(f.value); setDownloadUrl(null); }}
                  className="px-5 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    backgroundColor: format === f.value ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: format === f.value ? 'white' : 'var(--color-text)',
                    border: `1px solid ${format === f.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start From & Font Size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Start From</label>
              <input
                type="number" min="1" value={startFrom}
                onChange={(e) => { setStartFrom(parseInt(e.target.value) || 1); setDownloadUrl(null); }}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Font Size: {fontSize}px</label>
              <input type="range" min="8" max="36" step="1" value={fontSize}
                onChange={(e) => { setFontSize(parseInt(e.target.value)); setDownloadUrl(null); }}
                className="w-full accent-purple-500 mt-2" />
            </div>
          </div>
        </div>
      )}

      <ProcessButton
        onClick={handleProcess}
        processing={processing}
        progress={progress}
        downloadUrl={downloadUrl}
        downloadName={files.length > 0 ? files[0].name.replace(/\.[^/.]+$/, "") + "-numbered.pdf" : "numbered.pdf"}
        label="Add Page Numbers"
        disabled={files.length === 0}
      />
    </ToolLayout>
  );
}
