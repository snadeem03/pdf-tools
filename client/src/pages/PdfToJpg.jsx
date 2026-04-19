import { useState } from 'react';
import toast from 'react-hot-toast';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import { processFiles } from '../api';

export default function PdfToJpg() {
  const [files, setFiles] = useState([]);
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

      const { blob } = await processFiles('/pdf-to-jpg', formData, setProgress);
      setDownloadUrl(URL.createObjectURL(blob));
      setProgress(100);
      toast.success('PDF converted to images!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to convert');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolLayout title="PDF to JPG" description="Convert each PDF page into a JPG image (ZIP download)" color="#16a34a" icon="📸">
      <FileUpload accept=".pdf" onFilesSelected={setFiles} label="Drop a PDF file here" />
      <ProcessButton
        onClick={handleProcess}
        processing={processing}
        progress={progress}
        downloadUrl={downloadUrl}
        downloadName="pdf-images.zip"
        label="Convert to JPG"
        disabled={files.length === 0}
      />
    </ToolLayout>
  );
}
