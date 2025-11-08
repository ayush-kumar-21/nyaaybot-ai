# NYAAYBOT - AI-Powered Legal Assistant

NYAAYBOT is a comprehensive AI-powered legal assistant designed to make understanding Indian law accessible to everyone. The application uses Ollama with a local LLM (gpt-oss:20b) for reasoning and provides features for Constitution chatbot and document analysis.

## Features

- **Constitution Chatbot**: Ask questions about the Indian Constitution with web search integration for valid legal sources
  - **Constitution-Only Responses**: Strictly filters and provides only Constitution-related information
  - **Content Moderation**: Automatically filters profanity and inappropriate language
  - **Web Content Filtering**: Extracts and uses only Constitution-related content from valid legal sources
  - **Source Validation**: Only uses content from verified legal sources
- **Document Analysis**: Upload and analyze legal documents in various formats (PDF, DOC, DOCX, images) with OCR support
- **OCR Support**: Extract text from scanned documents and images
- **Web Search**: Access Constitution-related information from valid legal sources with automatic content filtering

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Ollama** installed and running
3. **gpt-oss:20b model** installed in Ollama

## Setup Instructions

### 1. Install Ollama

If you haven't installed Ollama yet, follow these steps:

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download from [https://ollama.com/download](https://ollama.com/download)

### 2. Install and Run Ollama Model

Start Ollama service:
```bash
ollama serve
```

In a new terminal, pull the gpt-oss:20b model:
```bash
ollama pull gpt-oss:20b
```

**Note:** The model name might be different. Check available models with:
```bash
ollama list
```

If the model name is different, update the model name in:
- `app/api/chat/route.ts` (line with `model: 'gpt-oss:20b'`)
- `app/api/analyze/route.ts` (line with `model: 'gpt-oss:20b'`)

### 3. Install Dependencies

```bash
cd nyaaybot-ai
npm install
```

### 4. Configure Environment Variables (Optional)

Create a `.env.local` file in the `nyaaybot-ai` directory:

```env
OLLAMA_HOST=http://localhost:11434
```

If Ollama is running on a different host or port, update this value.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Constitution Chatbot

1. Navigate to the "Constitution Chatbot" page
2. Type your question about the Indian Constitution
3. The chatbot will:
   - **Filter your input**: Automatically filters profanity and inappropriate language
   - **Search Constitution-only content**: Extracts only Constitution-related information from valid legal sources
   - **Content moderation**: Filters out non-Constitution content and inappropriate language
   - **Use Ollama with gpt-oss:20b**: Provides accurate, Constitution-focused answers
   - **Cite sources**: References valid legal sources when available
   - **Strict Constitution focus**: Only responds to Constitution-related questions; redirects other queries

### Document Analysis

1. Navigate to the "Case Analysis" page
2. Click "Choose Files" and select your documents
3. Supported formats:
   - **PDF**: Direct text extraction
   - **DOC/DOCX**: Word document processing
   - **Images**: OCR processing (JPG, PNG, GIF, BMP, WEBP)
   - **Text files**: Direct text reading
4. Click "Analyze Documents"
5. The system will:
   - Extract text from all files (using OCR for images)
   - Analyze the content using Ollama
   - Provide comprehensive legal analysis

## Supported File Types

- **Documents**: PDF, DOC, DOCX, TXT
- **Images**: JPG, JPEG, PNG, GIF, BMP, WEBP (with OCR)

## Valid Legal Sources

The chatbot searches for information from these valid sources:
- indiankanoon.org
- lawcommissionofindia.nic.in
- legislative.gov.in
- lawmin.gov.in
- supremecourtofindia.nic.in
- judis.nic.in
- constitutionofindia.net
- mea.gov.in

## Content Filtering & Moderation

The chatbot includes comprehensive content filtering:

1. **Profanity Filtering**: Automatically detects and filters profanity in user input and responses
2. **Constitution-Only Filtering**: Only extracts and uses content that is Constitution-related
3. **Source Validation**: Only uses content from verified legal sources
4. **Content Moderation**: Filters inappropriate language and non-Constitution content
5. **Response Validation**: Ensures all responses are Constitution-focused and appropriate

### Constitution Keywords

The system uses Constitution-related keywords to filter content:
- Constitution, Article, Amendment, Preamble
- Fundamental Rights, Directive Principles, Fundamental Duties
- Parliament, Legislature, Judiciary, Executive
- Constitutional provisions, legal concepts, and related terms

If content doesn't contain sufficient Constitution-related keywords, it is filtered out.

## Troubleshooting

### Ollama Connection Error

If you see "Cannot connect to Ollama":
1. Ensure Ollama is running: `ollama serve`
2. Check if the model is installed: `ollama list`
3. Verify the model name matches in the API routes
4. Check the OLLAMA_HOST environment variable

### Model Not Found

If you see "model not found":
1. Pull the correct model: `ollama pull gpt-oss:20b`
2. Or update the model name in the API routes to match your installed model

### Document Analysis Fails

1. Ensure files are not corrupted
2. Check file size limits (50MB per file)
3. For images, ensure they are clear and readable for OCR

## Project Structure

```
nyaaybot-ai/
├── app/
│   ├── api/
│   │   ├── chat/          # Chatbot API endpoint
│   │   └── analyze/       # Document analysis API endpoint
│   ├── page.tsx           # Main page component
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── package.json
└── README.md
```

## Technologies Used

- **Next.js 16**: React framework
- **Ollama**: Local LLM integration
- **Tesseract.js**: OCR for image processing
- **pdf-parse**: PDF text extraction
- **mammoth**: DOCX processing
- **sharp**: Image optimization
- **axios**: HTTP requests
- **cheerio**: Web scraping for legal sources

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Notes

- The web search feature may have limitations due to Google's anti-scraping measures. For production use, consider using a proper search API.
- OCR processing may take time for large images.
- Ensure sufficient system resources for running the gpt-oss:20b model locally.

## License

This project is private and proprietary.
