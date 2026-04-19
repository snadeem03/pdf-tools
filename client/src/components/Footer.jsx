export default function Footer() {
  return (
    <footer
      className="border-t py-8 mt-16"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          © {new Date().getFullYear()} PDFNova — All-in-one PDF toolkit. Built with ❤️
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          Your files are processed locally and deleted after conversion.
        </p>
      </div>
    </footer>
  );
}
