import { useState } from 'react';
import toast from 'react-hot-toast';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import { processFiles } from '../api';

export default function CompressPdf() {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [stats, setStats] = useState(null);

  const handleProcess = async () => {
    if (files.length === 0) return toast.error('Please upload a PDF file');
    setProcessing(true);
    setProgress(0);
    setStats(null);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);

      const { blob, headers } = await processFiles('/compress', formData, setProgress);
      setDownloadUrl(URL.createObjectURL(blob));
      setProgress(100);

      const originalSize = parseInt(headers['x-original-size']) || 0;
      const compressedSize = parseInt(headers['x-compressed-size']) || 0;
      const reduction = headers['x-reduction'] || '0%';
      setStats({ originalSize, compressedSize, reduction });

      toast.success(`Compressed! Size reduced by ${reduction}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to compress PDF');
    } finally {
      setProcessing(false);
    }
  };

  const formatSize = (bytes) => (bytes / 1048576).toFixed(2) + ' MB';

  return (
    <ToolLayout title="Compress PDF" description="Reduce PDF file size while maintaining quality" color="#0891b2" icon="📦">
      <FileUpload accept=".pdf" onUpload={setFiles} label="Drop a PDF file here" />

      {stats && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            { label: 'Original', value: formatSize(stats.originalSize), color: 'var(--color-text-secondary)' },
            { label: 'Compressed', value: formatSize(stats.compressedSize), color: 'var(--color-primary)' },
            { label: 'Reduction', value: stats.reduction, color: '#10b981' },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4 text-center">
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</p>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <ProcessButton
        onClick={handleProcess}
        processing={processing}
        progress={progress}
        downloadUrl={downloadUrl}
        downloadName={files.length > 0 ? files[0].name.replace(/\.[^/.]+$/, "") + "-compressed.pdf" : "compressed.pdf"}
        label="Compress PDF"
        disabled={files.length === 0}
      />
    </ToolLayout>
  );
}
