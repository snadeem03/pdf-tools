import { useState } from 'react';
import toast from 'react-hot-toast';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import { processFiles } from '../api';

export default function RotatePdf() {
  const [files, setFiles] = useState([]);
  const [angle, setAngle] = useState('90');
  const [pages, setPages] = useState('all');
  const [customPages, setCustomPages] = useState('');
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
      formData.append('angle', angle);
      formData.append('pages', pages === 'custom' ? customPages : 'all');

      const { blob } = await processFiles('/rotate', formData, setProgress);
      setDownloadUrl(URL.createObjectURL(blob));
      setProgress(100);
      toast.success('PDF rotated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to rotate');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolLayout title="Rotate PDF" description="Rotate pages to any orientation" color="#ca8a04" icon="🔄">
      <FileUpload accept=".pdf" onUpload={setFiles} label="Drop a PDF file here" />

      {files.length > 0 && (
        <div className="mt-6 space-y-4">
          {/* Angle selection */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Rotation Angle</label>
            <div className="flex gap-3">
              {['90', '180', '270'].map((a) => (
                <button
                  key={a}
                  onClick={() => { setAngle(a); setDownloadUrl(null); }}
                  className="px-6 py-3 rounded-xl font-medium text-sm transition-all"
                  style={{
                    backgroundColor: angle === a ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: angle === a ? 'white' : 'var(--color-text)',
                    border: `1px solid ${angle === a ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}
                >
                  {a}°
                </button>
              ))}
            </div>
          </div>

          {/* Page selection */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Pages to Rotate</label>
            <div className="flex gap-3">
              {['all', 'custom'].map((p) => (
                <button
                  key={p}
                  onClick={() => { setPages(p); setDownloadUrl(null); }}
                  className="px-6 py-3 rounded-xl font-medium text-sm transition-all"
                  style={{
                    backgroundColor: pages === p ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: pages === p ? 'white' : 'var(--color-text)',
                    border: `1px solid ${pages === p ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}
                >
                  {p === 'all' ? 'All Pages' : 'Custom Pages'}
                </button>
              ))}
            </div>
            {pages === 'custom' && (
              <input
                type="text"
                placeholder="e.g. 1, 3, 5"
                value={customPages}
                onChange={(e) => { setCustomPages(e.target.value); setDownloadUrl(null); }}
                className="mt-3 w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            )}
          </div>
        </div>
      )}

      <ProcessButton
        onClick={handleProcess}
        processing={processing}
        progress={progress}
        downloadUrl={downloadUrl}
        downloadName={files.length > 0 ? files[0].name.replace(/\.[^/.]+$/, "") + "-rotated.pdf" : "rotated.pdf"}
        label="Rotate PDF"
        disabled={files.length === 0}
      />
    </ToolLayout>
  );
}
