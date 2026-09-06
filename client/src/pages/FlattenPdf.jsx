import { useState, useRef, useEffect } from 'react';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import { processFiles } from '../api';
import toast from 'react-hot-toast';

export default function FlattenPdf() {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadName, setDownloadName] = useState('');
  const downloadUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    };
  }, []);

  const handleProcess = async () => {
    if (!file) return;

    setProcessing(true);
    setProgress(10);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { blob } = await processFiles('/flatten', formData, setProgress);

      const url = window.URL.createObjectURL(blob);
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = url;
      setDownloadUrl(url);
      setDownloadName(`flattened-${file.name}`);
      toast.success('PDF flattened successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to flatten PDF');
      console.error(err);
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="Flatten PDF"
      description="Make fillable PDF forms read-only by flattening them into a regular PDF document."
      icon="🔨"
    >
      {!downloadUrl ? (
        <>
          <FileUpload
            accept=".pdf"
            onUpload={(files) => setFile(files[0])}
            multiple={false}
          />

          {file && (
            <ProcessButton
              onClick={handleProcess}
              disabled={!file}
              processing={processing}
              progress={progress}
            />
          )}
        </>
      ) : (
        <ProcessButton
          downloadUrl={downloadUrl}
          downloadName={downloadName}
        />
      )}
    </ToolLayout>
  );
}
