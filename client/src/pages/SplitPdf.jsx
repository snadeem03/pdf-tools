import { useState } from 'react';
import toast from 'react-hot-toast';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import { processFiles } from '../api';

export default function SplitPdf() {
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState('all');
  const [ranges, setRanges] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleProcess = async () => {
    if (files.length === 0) return toast.error('Please upload a PDF file');
    if (mode === 'range' && !ranges.trim()) return toast.error('Please enter page ranges');

    setProcessing(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('mode', mode);
      if (mode === 'range') formData.append('ranges', ranges);

      const { blob, filename } = await processFiles('/split', formData, setProgress);
      setDownloadUrl(URL.createObjectURL(blob));
      setProgress(100);
      toast.success('PDF split successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to split PDF');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolLayout title="Split PDF" description="Separate pages or extract specific page ranges" color="#7c3aed" icon="✂️">
      <FileUpload accept=".pdf" onUpload={setFiles} label="Drop a PDF file here" />

      {files.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex gap-4">
            {['all', 'range'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setDownloadUrl(null); }}
                className="px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200"
                style={{
                  backgroundColor: mode === m ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: mode === m ? 'white' : 'var(--color-text)',
                  border: `1px solid ${mode === m ? 'var(--color-primary)' : 'var(--color-border)'}`,
                }}
              >
                {m === 'all' ? 'Extract All Pages' : 'Custom Range'}
              </button>
            ))}
          </div>

          {mode === 'range' && (
            <input
              type="text"
              placeholder="e.g. 1-3, 5, 7-9"
              value={ranges}
              onChange={(e) => { setRanges(e.target.value); setDownloadUrl(null); }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                focusRingColor: 'var(--color-primary)',
              }}
            />
          )}
        </div>
      )}

      <ProcessButton
        onClick={handleProcess}
        processing={processing}
        progress={progress}
        downloadUrl={downloadUrl}
        downloadName={files.length > 0 ? files[0].name.replace(/\.[^/.]+$/, "") + (mode === 'all' ? '-split-pages.zip' : '-split.pdf') : (mode === 'all' ? 'split-pages.zip' : 'split.pdf')}
        label="Split PDF"
        disabled={files.length === 0}
      />
    </ToolLayout>
  );
}
