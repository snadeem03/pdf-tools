import { useState } from 'react';
import toast from 'react-hot-toast';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import { processFiles } from '../api';

export default function WordToPdf() {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleProcess = async () => {
    if (files.length === 0) return toast.error('Please upload a Word document');
    setProcessing(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);

      const { blob } = await processFiles('/word-to-pdf', formData, setProgress);
      setDownloadUrl(URL.createObjectURL(blob));
      setProgress(100);
      toast.success('Converted to PDF successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to convert');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolLayout title="Word to PDF" description="Convert Word documents to PDF format" color="#dc2626" icon="📄">
      <FileUpload accept=".docx,.doc" onUpload={setFiles} label="Drop a Word document here" />
      <ProcessButton
        onClick={handleProcess}
        processing={processing}
        progress={progress}
        downloadUrl={downloadUrl}
        downloadName={files.length > 0 ? files[0].name.replace(/\.[^/.]+$/, "") + "-converted.pdf" : "converted.pdf"}
        label="Convert to PDF"
        disabled={files.length === 0}
      />
    </ToolLayout>
  );
}
