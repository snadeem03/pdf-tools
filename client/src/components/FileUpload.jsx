import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export default function FileUpload({ onUpload, multiple = false, accept = { 'application/pdf': ['.pdf'] } }) {
  const [selectedFiles, setSelectedFiles] = useState([]);

  const onDrop = useCallback((acceptedFiles) => {
    let filesToAdd = acceptedFiles;
    if (!multiple && acceptedFiles.length > 1) {
      filesToAdd = [acceptedFiles[0]];
    }

    const newFiles = multiple ? [...selectedFiles, ...filesToAdd] : filesToAdd;
    
    // limit multiple to 20 for basic boundary
    const limitedFiles = multiple ? newFiles.slice(0, 20) : newFiles;
    
    setSelectedFiles(limitedFiles);
    onUpload(limitedFiles);
  }, [multiple, selectedFiles, onUpload]);

  const removeFile = (index) => {
    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
    onUpload(updated);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple,
    maxSize: 52428800, // 50MB
  });

  return (
    <div className="w-full">
      {(!selectedFiles.length || multiple) && (
        <div
          {...getRootProps()}
          className={`drop-zone flex flex-col items-center justify-center p-12 cursor-pointer transition-all duration-500 rounded-2xl
            ${isDragActive ? 'active scale-105 shadow-[0_0_30px_rgba(var(--color-primary-rgb),0.3)]' : 'hover:border-[var(--color-primary-light)] hover:bg-[var(--color-surface-hover)]'}`}
        >
          <input {...getInputProps()} />

          {/* Upload Icon with glow effect */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all duration-500 shadow-xl relative group"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
              transform: isDragActive ? 'scale(1.1) rotate(5deg)' : 'scale(1)',
            }}
          >
            <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: 'var(--color-primary)' }}></div>
            <svg className="w-12 h-12 text-white relative z-10 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <p className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--color-text)' }}>
            {isDragActive ? 'Drop your files here!' : 'Drop PDF files here'}
          </p>
          <p className="text-sm text-center mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            {multiple ? 'Up to 20 files' : 'Max 50MB'} • {multiple ? 'Max 50MB each' : ''}
          </p>

          <span className="px-6 py-2 rounded-full font-semibold transition-all shadow-md group-hover:shadow-lg"
                style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-primary)', border: '1px solid var(--color-primary-light)' }}>
            Browse Files
          </span>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="mt-8 space-y-3">
          {multiple && <p className="text-sm font-semibold mb-3 px-2" style={{ color: 'var(--color-text-secondary)' }}>Files Selected:</p>}
          {selectedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-5 py-4 rounded-xl glass-card animate-fade-in-up transition-all hover:translate-x-1"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-3xl flex-shrink-0 drop-shadow-sm">📄</span>
                <span className="font-medium text-sm truncate max-w-[200px] sm:max-w-[400px]" style={{ color: 'var(--color-text)' }}>
                  {file.name}
                </span>
                <span className="text-xs px-2 py-1 rounded bg-[rgba(var(--color-primary-rgb),0.1)] text-[var(--color-primary)] font-semibold flex-shrink-0">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40 dark:hover:text-red-400 transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onClick={() => removeFile(idx)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
