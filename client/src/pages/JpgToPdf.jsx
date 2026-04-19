import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import { processFiles } from '../api';

export default function JpgToPdf() {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleFilesSelected = useCallback((newFiles) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setDownloadUrl(null);
  }, []);

  const handleProcess = async () => {
    if (files.length === 0) return toast.error('Please upload at least one image');
    setProcessing(true);
    setProgress(0);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));

      const { blob } = await processFiles('/jpg-to-pdf', formData, setProgress);
      setDownloadUrl(URL.createObjectURL(blob));
      setProgress(100);
      toast.success('Images converted to PDF!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to convert');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolLayout title="JPG to PDF" description="Convert images (JPG, PNG) into a single PDF" color="#ea580c" icon="🖼️">
      <FileUpload accept="image/*" multiple onUpload={handleFilesSelected} label="Drop images here" maxFiles={50} />
      <ProcessButton
        onClick={handleProcess}
        processing={processing}
        progress={progress}
        downloadUrl={downloadUrl}
        downloadName={files.length > 0 ? files[0].name.replace(/\.[^/.]+$/, "") + "-images.pdf" : "images.pdf"}
        label="Convert to PDF"
        disabled={files.length === 0}
      />
    </ToolLayout>
  );
}
