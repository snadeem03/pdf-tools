import { useState } from 'react';
import toast from 'react-hot-toast';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import { processFiles } from '../api';

export default function PdfToWord() {
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

      const { blob } = await processFiles('/pdf-to-word', formData, setProgress);
      setDownloadUrl(URL.createObjectURL(blob));
      setProgress(100);
      toast.success('Converted to Word successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to convert');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolLayout title="PDF to Word" description="Convert PDF documents to editable DOCX format" color="#2563eb" icon="📝">
      <FileUpload accept=".pdf" onUpload={setFiles} label="Drop a PDF file here" />
      <ProcessButton
        onClick={handleProcess}
        processing={processing}
        progress={progress}
        downloadUrl={downloadUrl}
        downloadName={files.length > 0 ? files[0].name.replace(/\.[^/.]+$/, "") + "-converted.docx" : "converted.docx"}
        label="Convert to Word"
        disabled={files.length === 0}
      />
    </ToolLayout>
  );
}
