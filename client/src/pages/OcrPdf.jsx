import { useState } from 'react';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import api from '../api';
import toast from 'react-hot-toast';

export default function OcrPdf() {
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
      const res = await api.post('/ocr', formData, {
        responseType: 'blob',
        onUploadProgress: (ev) => {
          const p = Math.round((ev.loaded * 100) / ev.total);
          setProgress(Math.max(10, p));
        },
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      setDownloadUrl(url);
      setDownloadName(`ocr-${file.name.replace(/\.[^/.]+$/, "")}.txt`);
      toast.success('Text extracted successfully!');
    } catch (err) {
      toast.error('Failed to extract text');
      console.error(err);
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="OCR Image to Text"
      description="Extract text from an image. Perfect for turning scanned documents into editable text files."
      icon="👁️"
    >
      {!downloadUrl ? (
        <>
          <FileUpload
            onUpload={(files) => setFile(files[0])}
            multiple={false}
            accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }}
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
