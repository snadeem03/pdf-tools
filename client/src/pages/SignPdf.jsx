import { useState } from 'react';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import PdfInteractiveViewer from '../components/PdfInteractiveViewer';
import api from '../api';
import toast from 'react-hot-toast';

export default function SignPdf() {
  const [pdfFile, setPdfFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadName, setDownloadName] = useState('');
  const [signLocation, setSignLocation] = useState(null);

  const handleProcess = async () => {
    if (!pdfFile || !signatureFile || !signLocation) {
      if (!signLocation) toast.error('Please click on the PDF to place your signature');
      return;
    }

    setProcessing(true);
    setProgress(10);
    const formData = new FormData();
    formData.append('pdf', pdfFile);
    formData.append('signature', signatureFile);
    formData.append('pageIndex', signLocation.pageIndex);
    formData.append('x', signLocation.x);
    formData.append('y', signLocation.y);

    try {
      const res = await api.post('/sign', formData, {
        responseType: 'blob',
        onUploadProgress: (ev) => {
          const p = Math.round((ev.loaded * 100) / ev.total);
          setProgress(Math.max(10, p));
        },
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      setDownloadUrl(url);
      setDownloadName(`signed-${pdfFile.name}`);
      toast.success('PDF signed successfully!');
    } catch (err) {
      toast.error('Failed to sign PDF');
      console.error(err);
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="e-Sign PDF"
      description="Upload your PDF and a signature image, then click where you want to sign."
      icon="✍️"
    >
      {!downloadUrl ? (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>1. Upload PDF Document</h3>
              <FileUpload
                onUpload={(files) => {
                  setPdfFile(files[0]);
                  setSignLocation(null);
                }}
                multiple={false}
              />
            </div>

            <div>
               <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>2. Upload Signature Image</h3>
               <FileUpload
                onUpload={(files) => setSignatureFile(files[0])}
                multiple={false}
                accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
              />
            </div>
          </div>

          {pdfFile && (
            <div>
              <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>3. Place Signature</h3>
              <PdfInteractiveViewer 
                file={pdfFile} 
                overlayConfig={{ type: 'image', file: signatureFile }}
                onPlace={setSignLocation}
              />
            </div>
          )}


          <ProcessButton
            onClick={handleProcess}
            disabled={!pdfFile || !signatureFile || !signLocation}
            processing={processing}
            progress={progress}
            text="Sign PDF"
          />
        </div>
      ) : (
        <ProcessButton
          downloadUrl={downloadUrl}
          downloadName={downloadName}
        />
      )}
    </ToolLayout>
  );
}

