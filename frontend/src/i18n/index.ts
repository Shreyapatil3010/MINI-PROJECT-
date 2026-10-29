import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      // Header
      appName: "Financial Document Analyst",
      appSubtitle: "AI-powered financial analysis agent",
      hideDocuments: "Hide Documents",
      showDocuments: "Show Documents",
      docsSelected: "{{count}} doc selected",
      docsSelected_plural: "{{count}} docs selected",

      // Sidebar
      documents: "Documents",

      // Upload
      dragDrop: "or drag & drop PDFs here",
      chooseFile: "Choose a file",
      uploadedDocs: "Uploaded Documents ({{count}})",
      selected: "{{count}} selected",
      pages: "pages",

      // Tabs
      analyze: "Analyze",
      compare: "Compare",
      metrics: "Metrics",

      // Chat
      askAnything: "Ask anything about your financial documents",
      uploadFirst: "Upload and select documents on the left to start analyzing.",
      docsReady: "{{count}} document(s) selected. Ask me anything.",
      suggestedQuestions: "Suggested Questions",
      followUp: "Follow-up Questions",
      analyzing: "Analyzing documents...",
      sendPlaceholder: "Ask about revenue trends, profit margins, cash flow...",
      uploadPlaceholder: "Upload and select documents first...",
      pressEnter: "Press Enter to send · Shift+Enter for new line",
      selectAtLeastOne: "Select at least one document to start analyzing.",

      // Compare
      compareDocs: "Compare Two Financial Documents",
      documentA: "Document A",
      documentB: "Document B",
      selectDoc: "Select document...",
      compareButton: "Compare Documents",
      comparing: "Comparing...",
      uploadTwoDocs: "Upload at least 2 documents to enable comparison.",

      // Metrics
      financialMetrics: "Financial Metrics",
      selectDocsMetrics: "Select documents to view extracted financial metrics.",
      noTables: "No structured financial tables detected. Try asking questions in the Analyze tab.",

      // Export
      exportPDF: "Export PDF",
      exporting: "Exporting...",

      // History
      history: "History",
      clearHistory: "Clear",
      noHistory: "No conversations yet.",
      loadConversation: "Load",
    },
  },
  hi: {
    translation: {
      // Header
      appName: "वित्तीय दस्तावेज़ विश्लेषक",
      appSubtitle: "AI-संचालित वित्तीय विश्लेषण एजेंट",
      hideDocuments: "दस्तावेज़ छुपाएं",
      showDocuments: "दस्तावेज़ दिखाएं",
      docsSelected: "{{count}} दस्तावेज़ चुना",
      docsSelected_plural: "{{count}} दस्तावेज़ चुने",

      // Sidebar
      documents: "दस्तावेज़",

      // Upload
      dragDrop: "या PDFs यहाँ drag & drop करें",
      chooseFile: "फ़ाइल चुनें",
      uploadedDocs: "अपलोड किए गए दस्तावेज़ ({{count}})",
      selected: "{{count}} चुने गए",
      pages: "पृष्ठ",

      // Tabs
      analyze: "विश्लेषण",
      compare: "तुलना",
      metrics: "मेट्रिक्स",

      // Chat
      askAnything: "अपने वित्तीय दस्तावेज़ों के बारे में कुछ भी पूछें",
      uploadFirst: "विश्लेषण शुरू करने के लिए बाईं ओर दस्तावेज़ अपलोड करें।",
      docsReady: "{{count}} दस्तावेज़ चुने गए। कुछ भी पूछें।",
      suggestedQuestions: "सुझाए गए प्रश्न",
      followUp: "अनुवर्ती प्रश्न",
      analyzing: "दस्तावेज़ों का विश्लेषण हो रहा है...",
      sendPlaceholder: "राजस्व, लाभ मार्जिन, नकदी प्रवाह के बारे में पूछें...",
      uploadPlaceholder: "पहले दस्तावेज़ अपलोड करें...",
      pressEnter: "भेजने के लिए Enter दबाएं · नई लाइन के लिए Shift+Enter",
      selectAtLeastOne: "विश्लेषण शुरू करने के लिए कम से कम एक दस्तावेज़ चुनें।",

      // Compare
      compareDocs: "दो वित्तीय दस्तावेज़ों की तुलना करें",
      documentA: "दस्तावेज़ A",
      documentB: "दस्तावेज़ B",
      selectDoc: "दस्तावेज़ चुनें...",
      compareButton: "दस्तावेज़ तुलना करें",
      comparing: "तुलना हो रही है...",
      uploadTwoDocs: "तुलना के लिए कम से कम 2 दस्तावेज़ अपलोड करें।",

      // Metrics
      financialMetrics: "वित्तीय मेट्रिक्स",
      selectDocsMetrics: "वित्तीय मेट्रिक्स देखने के लिए दस्तावेज़ चुनें।",
      noTables: "कोई वित्तीय तालिका नहीं मिली। विश्लेषण टैब में प्रश्न पूछें।",

      // Export
      exportPDF: "PDF निर्यात करें",
      exporting: "निर्यात हो रहा है...",

      // History
      history: "इतिहास",
      clearHistory: "साफ़ करें",
      noHistory: "अभी तक कोई बातचीत नहीं।",
      loadConversation: "लोड करें",
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

export default i18n;
