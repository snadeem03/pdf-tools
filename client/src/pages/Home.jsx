import ToolCard from '../components/ToolCard';

const tools = [
  { title: 'Merge PDF', description: 'Combine multiple PDFs into one document', icon: '🔗', path: '/merge', color: '#4f46e5' },
  { title: 'Split PDF', description: 'Separate pages or extract page ranges', icon: '✂️', path: '/split', color: '#7c3aed' },
  { title: 'Compress PDF', description: 'Reduce file size without losing quality', icon: '📦', path: '/compress', color: '#0891b2' },
  { title: 'PDF to Word', description: 'Convert PDF documents to editable DOCX', icon: '📝', path: '/pdf-to-word', color: '#2563eb' },
  { title: 'Word to PDF', description: 'Convert Word documents to PDF format', icon: '📄', path: '/word-to-pdf', color: '#dc2626' },
  { title: 'JPG to PDF', description: 'Turn images into a PDF document', icon: '🖼️', path: '/jpg-to-pdf', color: '#ea580c' },
  { title: 'PDF to JPG', description: 'Extract pages as JPG images', icon: '📸', path: '/pdf-to-jpg', color: '#16a34a' },
  { title: 'Rotate PDF', description: 'Rotate pages to any orientation', icon: '🔄', path: '/rotate', color: '#ca8a04' },
  { title: 'Watermark', description: 'Add custom text watermark to pages', icon: '💧', path: '/watermark', color: '#6366f1' },
  { title: 'Page Numbers', description: 'Add page numbers to your PDF', icon: '🔢', path: '/page-numbers', color: '#9333ea' },
];

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero Section */}
      <div className="text-center mb-16 mt-8">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
          Every tool you need to work with PDFs
        </h1>
        <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
          Merge, split, compress, convert, rotate, watermark and much more.
          Free, fast, and secure — all in your browser.
        </p>
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tools.map((tool, idx) => (
          <ToolCard key={tool.path} {...tool} delay={idx * 60} />
        ))}
      </div>

      {/* Trust Section */}
      <div className="mt-20 text-center">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
          {[
            { icon: '🔒', title: 'Secure', desc: 'Files are processed on our server and deleted immediately' },
            { icon: '⚡', title: 'Fast', desc: 'Optimized processing for instant results' },
            { icon: '💎', title: 'Free', desc: 'All tools are completely free to use' },
          ].map((item) => (
            <div key={item.title} className="flex flex-col items-center gap-2">
              <span className="text-3xl">{item.icon}</span>
              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{item.title}</span>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
