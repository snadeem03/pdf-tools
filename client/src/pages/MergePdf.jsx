import { useState, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import ToolLayout from '../components/ToolLayout';
import FileUpload from '../components/FileUpload';
import ProcessButton from '../components/ProcessButton';
import { processFiles } from '../api';

function SortableItem({ id, file, index }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <span className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>☰</span>
      <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
        style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))' }}>
        {index + 1}
      </span>
      <span className="text-sm font-medium truncate flex-1" style={{ color: 'var(--color-text)' }}>{file.name}</span>
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{(file.size / 1048576).toFixed(1)} MB</span>
    </div>
  );
}

export default function MergePdf() {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFilesSelected = useCallback((newFiles) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setDownloadUrl(null);
  }, []);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((_, i) => `file-${i}` === active.id);
        const newIndex = items.findIndex((_, i) => `file-${i}` === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleProcess = async () => {
    if (files.length < 2) {
      toast.error('Please add at least 2 PDF files');
      return;
    }
    setProcessing(true);
    setProgress(0);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      formData.append('order', JSON.stringify(files.map((_, i) => i)));

      const { blob } = await processFiles('/merge', formData, setProgress);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setProgress(100);
      toast.success('PDFs merged successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to merge PDFs');
    } finally {
      setProcessing(false);
    }
  };

  const ids = files.map((_, i) => `file-${i}`);

  return (
    <ToolLayout title="Merge PDF" description="Combine multiple PDF files into one. Drag to reorder." color="#4f46e5" icon="🔗">
      <FileUpload accept=".pdf" multiple onFilesSelected={handleFilesSelected} label="Drop PDF files here" maxFiles={20} />

      {files.length > 1 && (
        <div className="mt-6">
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Drag to reorder files:
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {files.map((file, idx) => (
                  <SortableItem key={`file-${idx}`} id={`file-${idx}`} file={file} index={idx} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <ProcessButton
        onClick={handleProcess}
        processing={processing}
        progress={progress}
        downloadUrl={downloadUrl}
        downloadName="merged.pdf"
        label="Merge PDFs"
        disabled={files.length < 2}
      />
    </ToolLayout>
  );
}
