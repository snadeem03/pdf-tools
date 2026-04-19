import ToolCard from '../components/ToolCard';

const tools = [
  { title: 'Merge PDF', description: 'Combine multiple PDFs into one document', icon: '🔗', path: '/merge' },
  { title: 'Split PDF', description: 'Separate pages or extract page ranges', icon: '✂️', path: '/split' },
  { title: 'Compress PDF', description: 'Reduce file size without losing quality', icon: '📦', path: '/compress' },
  { title: 'PDF to Word', description: 'Convert PDF documents to editable DOCX', icon: '📝', path: '/pdf-to-word' },
  { title: 'Word to PDF', description: 'Convert Word documents to PDF format', icon: '📄', path: '/word-to-pdf' },
  { title: 'JPG to PDF', description: 'Turn images into a PDF document', icon: '🖼️', path: '/jpg-to-pdf' },
  { title: 'PDF to JPG', description: 'Extract pages as JPG images', icon: '📸', path: '/pdf-to-jpg' },
  { title: 'Rotate PDF', description: 'Rotate pages to any orientation', icon: '🔄', path: '/rotate' },
  { title: 'Watermark', description: 'Add custom text watermark to pages', icon: '💧', path: '/watermark' },
  { title: 'Page Numbers', description: 'Add page numbers to your PDF', icon: '🔢', path: '/page-numbers' },
  { title: 'OCR to Text', description: 'Extract text from scanned PDFs & images', icon: '👁️', path: '/ocr' },
  { title: 'Flatten PDF', description: 'Make form fields read-only and flat', icon: '🔨', path: '/flatten' },
  { title: 'Sign PDF', description: 'e-Sign your document with an image', icon: '✍️', path: '/sign' },
  { title: 'Remove Watermark', description: 'Erase, censor, or cleanly crop out watermarks from PDFs', icon: '🧼', path: '/remove-watermark' },
];

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[var(--color-primary)] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse-slow z-0"></div>
      <div className="absolute top-40 right-0 w-96 h-96 bg-[var(--color-primary-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse-slow z-0" style={{ animationDelay: '2s' }}></div>

      {/* Hero Section */}
      <div className="text-center mb-20 animate-fade-in-up relative z-10">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-[var(--color-primary)] bg-[var(--color-primary)] bg-opacity-10 text-[var(--color-primary)] font-semibold text-sm tracking-wide uppercase shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.2)]">
          ✨ Premium PDF Playground
        </div>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6 leading-tight" style={{ color: 'var(--color-text)' }}>
          Every tool you need to <br className="hidden sm:block" />
          <span
            className="bg-clip-text text-transparent relative drop-shadow-sm"
            style={{ backgroundImage: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))' }}
          >
            work with PDFs
          </span>
        </h1>
        <p className="text-xl max-w-2xl mx-auto font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Merge, split, compress, convert, rotate, watermark and much more.
          Experience the golden standard of PDF management in a beautiful, fast interface.
        </p>
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 relative z-10">
        {tools.map((tool, idx) => (
          <ToolCard key={tool.path} {...tool} delay={idx * 50} />
        ))}
      </div>

      {/* Trust Section */}
      <div className="mt-32 text-center animate-fade-in-up glass-card py-12 px-8 max-w-4xl mx-auto relative z-10" style={{ animationDelay: '600ms' }}>
        <h2 className="text-2xl font-bold mb-10" style={{ color: 'var(--color-text)' }}>Why choose our toolkit?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { icon: '🔒', title: 'Bank-Grade Security', desc: 'Files are processed on our secure server and deleted immediately.' },
            { icon: '⚡', title: 'Lightning Fast', desc: 'Optimized node processing for instant high-quality results.' },
            { icon: '💎', title: 'Golden Standard', desc: 'Impeccable quality and completely free to use without limits.' },
          ].map((item) => (
            <div key={item.title} className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg" style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg))' }}>
                {item.icon}
              </div>
              <span className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>{item.title}</span>
              <span className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
