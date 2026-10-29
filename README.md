# 📈 Financial Document Analysis Agent

An AI-powered agent for analyzing financial documents — annual reports, financial statements, quarterly reports, and investor presentations.

---

## Features

| Feature | Description |
|---|---|
| 📄 Document Upload | Drag & drop PDF financial documents |
| 🤖 AI Analysis | Ask natural language questions about financials |
| 📊 Chart Generation | Auto-generates trend charts and growth rate graphs |
| 📋 Table Extraction | Extracts financial tables with headers and data |
| 📈 Trend Analysis | Year-over-year comparisons and CAGR calculations |
| 🔍 Inconsistency Detection | Flags anomalies and red flags automatically |
| 🔖 Source Citations | Every answer cites the exact document and page |
| ⚖️ Document Comparison | Compares two annual reports side-by-side |
| 💬 Conversation History | Multi-turn chat with memory of prior questions |
| 🎯 Suggested Questions | Context-aware follow-up question suggestions |

---

## Tech Stack

**Backend**
- Python + FastAPI
- pdfplumber for PDF extraction and table parsing
- OpenAI GPT-4o for reasoning and analysis
- Matplotlib for chart generation
- Pandas + NumPy for financial calculations

**Frontend**
- React + TypeScript
- Tailwind CSS
- Recharts / Lucide React icons
- React Dropzone for file uploads

---

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

Then run:
```bash
./start_backend.sh
```

The API will be available at **http://localhost:8000**  
Swagger docs at **http://localhost:8000/docs**

### 2. Frontend

```bash
./start_frontend.sh
```

The app will open at **http://localhost:3000**

---

## Usage

### Analyzing Documents

1. Upload one or more PDFs using the left panel (drag & drop or browse)
2. Check the documents you want to analyze
3. Ask questions in the **Analyze** tab:
   - *"How did revenue change over the last 5 years?"*
   - *"What is the trend in net income and profit margins?"*
   - *"Are there any financial red flags?"*
   - *"What does the cash flow statement show?"*

### Comparing Documents

1. Upload at least two reports (e.g., two annual reports)
2. Go to the **Compare** tab
3. Select Document A and Document B
4. Click **Compare Documents**

### Viewing Metrics

The **Metrics** tab shows all automatically extracted financial metrics with sparkline charts.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | required | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model to use |
| `MAX_UPLOAD_SIZE_MB` | `50` | Maximum upload file size |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded PDFs |
| `CHARTS_DIR` | `./charts` | Directory for generated charts |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/documents/upload` | Upload a PDF document |
| GET | `/documents` | List all uploaded documents |
| DELETE | `/documents/{id}` | Delete a document |
| GET | `/documents/{id}/metrics` | Get extracted financial metrics |
| GET | `/documents/{id}/tables` | Get extracted tables |
| GET | `/documents/{id}/summary` | AI executive summary |
| POST | `/analyze` | Natural language analysis query |
| POST | `/compare` | Compare two documents |
| GET | `/documents/{id}/suggested-questions` | Suggested questions |

---

## Example Questions

- *"How did the company's revenue change over the last five years?"*
- *"What is the compound annual growth rate of net income?"*
- *"Compare the gross margin between these two annual reports."*
- *"What were the key risks mentioned in the annual report?"*
- *"How has the debt-to-equity ratio changed?"*
- *"Were there any unusual items or one-time charges?"*
- *"What changed between these two annual reports?"*
