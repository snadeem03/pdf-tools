import { useState } from 'react';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import api from '../api';
import toast from 'react-hot-toast';

export default function FlattenPdf() {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadName, setDownloadName] = useState('');

  const handleProcess = async () => {
    if (!file) return;

    setProcessing(true);
    setProgress(10);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/flatten', formData, {
        responseType: 'blob',
        onUploadProgress: (ev) => {
          const p = Math.round((ev.loaded * 100) / ev.total);
          setProgress(Math.max(10, p));
        },
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      setDownloadUrl(url);
      setDownloadName(`flattened-${file.name}`);
      toast.success('PDF flattened successfully!');
    } catch (err) {
      toast.error('Failed to flatten PDF');
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
