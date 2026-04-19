import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation files would typically be split into separate JSON files,
// but for simplicity we bundle them here for the core UI.
const resources = {
  en: {
    translation: {
      "app": {
        "title": "PDFNova",
        "tagline": "Every tool you need to work with PDFs in one place",
        "description": "All are 100% FREE and easy to use! Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks.",
        "allTools": "All Tools",
        "login": "Login / Sign Up",
        "logout": "Logout",
        "language": "Language"
      },
      "tools": {
        "merge": { "title": "Merge PDF", "desc": "Combine PDFs in the order you want with the easiest PDF merger available." },
        "split": { "title": "Split PDF", "desc": "Separate one page or a whole set for easy conversion into independent PDF files." },
        "compress": { "title": "Compress PDF", "desc": "Reduce file size while optimizing for maximal PDF quality." }
        // Note: Additional tool translations omitted for brevity. You would add them here.
      }
    }
  },
  es: {
    translation: {
      "app": {
        "title": "PDFNova",
        "tagline": "Todas las herramientas necesarias para usar PDFs en tu alcance",
        "description": "¡Todas son 100% GRATUITAS y fáciles de usar! Une, divide, comprime, convierte, gira, desbloquea y añade marcas de agua a tus PDFs con solo unos pocos clics.",
        "allTools": "Todas las Herramientas",
        "login": "Ingresar / Registrarse",
        "logout": "Cerrar sesión",
        "language": "Idioma"
      },
      "tools": {
        "merge": { "title": "Unir PDF", "desc": "Une PDFs en el orden que quieras con el combinador más fácil." },
        "split": { "title": "Dividir PDF", "desc": "Extrae páginas individuales o toda la colección de hojas enteras." },
        "compress": { "title": "Comprimir PDF", "desc": "Reduce el tamaño de tu archivo asegurando la mayor calidad posible." }
      }
    }
  },
  hi: {
    translation: {
      "app": {
        "title": "PDFNova",
        "tagline": "PDF के साथ काम करने के लिए आवश्यक हर उपकरण एक जगह पर",
        "description": "सभी 100% मुफ़्त और उपयोग में आसान हैं! बस कुछ ही क्लिक से PDF को मर्ज करें, विभाजित करें, कंप्रेस करें, कन्वर्ट करें, घुमाएं, अनलॉक करें और वॉटरमार्क जोड़ें।",
        "allTools": "सभी उपकरण",
        "login": "लॉगिन / साइन अप",
        "logout": "लॉग आउट",
        "language": "भाषा"
      },
      "tools": {
        "merge": { "title": "PDF मर्ज करें", "desc": "अपनी इच्छानुसार क्रम में PDF को संयोजित करें।" },
        "split": { "title": "PDF विभाजित करें", "desc": "एक पृष्ठ या पूरे सेट को अलग करें।" },
        "compress": { "title": "PDF छोटा करें", "desc": "अधिकतम PDF गुणवत्ता के साथ फ़ाइल का आकार कम करें।" }
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already safes from xss
    }
  });

export default i18n;
