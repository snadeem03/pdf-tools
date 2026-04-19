# PDF Tools — All-in-one PDF Toolkit

A production-ready web application similar to iLovePDF with 10 fully functional PDF tools.

## Features

| Tool | Description |
|------|------------|
| Merge PDF | Combine multiple PDFs with drag-and-drop reorder |
| Split PDF | Extract pages by range or split all pages |
| Compress PDF | Reduce file size with compression stats |
| PDF to Word | Convert PDF to editable DOCX |
| Word to PDF | Convert DOCX to PDF |
| JPG to PDF | Convert images to PDF |
| PDF to JPG | Convert PDF pages to JPG images (ZIP) |
| Rotate PDF | Rotate selected/all pages (90°/180°/270°) |
| Watermark | Add text watermark with position/opacity/color |
| Page Numbers | Add page numbers with format options |

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **PDF Processing:** pdf-lib, pdf-merger-js, sharp, mammoth, docx
- **Features:** Dark mode, drag-and-drop, rate limiting, logging, temp file cleanup

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd pdf-tools

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Running Locally

**Terminal 1 — Backend:**
```bash
cd server
node server.js
# Runs on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# Runs on http://localhost:5173
```

Open http://localhost:5173 in your browser.

### Environment Variables

Copy `server/.env.example` to `server/.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|------------|
| PORT | 3001 | API server port |
| UPLOAD_DIR | uploads | Temp file directory |
| MAX_FILE_SIZE | 52428800 | Max upload size (50MB) |
| RATE_LIMIT_WINDOW_MS | 900000 | Rate limit window (15 min) |
| RATE_LIMIT_MAX | 100 | Max requests per window |

## Folder Structure

```
pdf-tools/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Tool pages
│   │   ├── api.js          # API helper
│   │   ├── App.jsx         # Router + dark mode
│   │   └── index.css       # Tailwind + design system
│   └── vite.config.js
├── server/                 # Express backend
│   ├── controllers/        # Tool logic
│   ├── routes/             # API routes
│   ├── utils/              # Upload, cleanup, logger, fallback
│   ├── server.js           # Entry point
│   └── .env.example
└── README.md
```
