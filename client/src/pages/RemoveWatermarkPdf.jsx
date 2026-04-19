import { useState } from 'react';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import api from '../api';
import toast from 'react-hot-toast';

export default function RemoveWatermarkPdf() {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadName, setDownloadName] = useState('');

  const [mode, setMode] = useState('redact');
  const [marginTop, setMarginTop] = useState(50);
  const [marginBottom, setMarginBottom] = useState(50);
  const [marginLeft, setMarginLeft] = useState(0);
  const [marginRight, setMarginRight] = useState(0);

  const handleProcess = async () => {
    if (!file) return;

    setProcessing(true);
    setProgress(10);
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('mode', mode);
    formData.append('marginTop', marginTop);
    formData.append('marginBottom', marginBottom);
    formData.append('marginLeft', marginLeft);
    formData.append('marginRight', marginRight);

    try {
      const res = await api.post('/remove-watermark', formData, {
        responseType: 'blob',
        onUploadProgress: (ev) => {
          const p = Math.round((ev.loaded * 100) / ev.total);
          setProgress(Math.max(10, p));
        },
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      setDownloadUrl(url);
      setDownloadName(`cleansed-${file.name}`);
      toast.success('Watermark successfully removed!');
    } catch (err) {
      toast.error('Failed to process PDF');
      console.error(err);
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="Remove Watermark"
      description="Erase, censor, or cleanly crop out watermarks from the margins of your PDF documents!"
      icon="🧼"
    >
      {!downloadUrl ? (
        <div className="flex flex-col gap-8">
          <FileUpload onUpload={(files) => setFile(files[0])} multiple={false} />

          <div className="glass-card p-6 flex flex-col gap-6 animate-fade-in-up">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Removal Strategy</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full p-3 rounded-xl border outline-none font-medium focus:ring-2 bg-transparent"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                <option value="redact" style={{ color: 'var(--color-text)', background: 'var(--color-bg)' }}>Whiteout / Erase Margins</option>
                <option value="crop" style={{ color: 'var(--color-text)', background: 'var(--color-bg)' }}>Crop out Margins</option>
              </select>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                {mode === 'redact' ? "Draws a white box over the margins, flawlessly hiding watermarks on text documents." 
                                   : "Slices the literal pages internally, totally eliminating the watermark boundaries."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Top Margin (px)</label>
                <input type="number" value={marginTop} onChange={(e) => setMarginTop(e.target.value)}
                       className="w-full p-2 rounded-lg border outline-none font-mono bg-transparent"
                       style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Bottom Margin (px)</label>
                <input type="number" value={marginBottom} onChange={(e) => setMarginBottom(e.target.value)}
                       className="w-full p-2 rounded-lg border outline-none font-mono bg-transparent"
                       style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Left Margin (px)</label>
                <input type="number" value={marginLeft} onChange={(e) => setMarginLeft(e.target.value)}
                       className="w-full p-2 rounded-lg border outline-none font-mono bg-transparent"
                       style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Right Margin (px)</label>
                <input type="number" value={marginRight} onChange={(e) => setMarginRight(e.target.value)}
                       className="w-full p-2 rounded-lg border outline-none font-mono bg-transparent"
                       style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              </div>
            </div>
          </div>

          <ProcessButton
            onClick={handleProcess}
            disabled={!file}
            processing={processing}
            progress={progress}
          />
        </div>
      ) : (
        <ProcessButton
          downloadUrl={downloadUrl}
          downloadName={downloadName}
        />
      )}
    </ToolLayout>
  );
}
