import { useState, useRef, useCallback } from 'react';

/**
 * Drag-and-drop file upload component with progress indicator.
 * Props:
 *   accept: string (e.g. ".pdf", "image/*")
 *   multiple: boolean
 *   onFilesSelected: (files: File[]) => void
 *   label: string
 *   maxFiles: number
 */
export default function FileUpload({ accept = '.pdf', multiple = false, onFilesSelected, label = 'Drop files here or click to browse', maxFiles = 20 }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const inputRef = useRef(null);

  const handleFiles = useCallback((files) => {
    const fileArray = Array.from(files).slice(0, maxFiles);
    setSelectedFiles(fileArray);
    onFilesSelected?.(fileArray);
  }, [maxFiles, onFilesSelected]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => setIsDragActive(false);

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e) => handleFiles(e.target.files);

  const removeFile = (index) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected?.(newFiles);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <div
        className={`drop-zone flex flex-col items-center justify-center py-16 px-6 cursor-pointer ${isDragActive ? 'active' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />

        {/* Upload Icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-transform duration-300"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
            transform: isDragActive ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        <p className="text-lg font-medium mb-1" style={{ color: 'var(--color-text)' }}>{label}</p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {multiple ? `Up to ${maxFiles} files • Max 50MB each` : 'Max 50MB'}
        </p>
      </div>

      {/* File List */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {selectedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-4 py-3 rounded-xl animate-fade-in-up"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl flex-shrink-0">📄</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{file.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatSize(file.size)}</p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                className="text-sm px-2 py-1 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-500"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
