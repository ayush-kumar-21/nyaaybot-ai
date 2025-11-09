'use client';

import { useState, useRef, useEffect } from 'react';
import Filter from 'bad-words';

// Initialize profanity filter
const filter = new Filter();

// Simple markdown renderer component
function MarkdownRenderer({ text }: { text: string }) {
  const renderMarkdown = (content: string) => {
    // Split by lines for processing
    const lines = content.split('\n');
    const elements: React.ReactElement[] = [];
    let inTable = false;
    let tableRows: string[] = [];
    let currentList: string[] = [];
    let inBlockquote = false;
    let blockquoteContent: string[] = [];

    const processTable = () => {
      if (tableRows.length === 0) return null;
      
      // Filter out separator rows (rows with only dashes and pipes)
      const validRows = tableRows.filter(row => !row.match(/^[\|\s\-:]+$/));
      
      if (validRows.length === 0) return null;
      
      const headerRow = validRows[0];
      const dataRows = validRows.slice(1);
      
      const headerCells = headerRow.split('|').map(cell => cell.trim()).filter(cell => cell);
      const rows = dataRows.map(row => 
        row.split('|').map(cell => cell.trim()).filter(cell => cell)
      );
      
      return (
        <div key={`table-wrapper-${elements.length}`} className="my-6 overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr className="bg-[rgba(255,107,53,0.15)]">
                {headerCells.map((cell, idx) => (
                  <th key={idx} className="border border-[rgba(255,255,255,0.3)] px-5 py-3 text-left font-semibold text-[#2d3748] text-[0.9375rem]">
                    {renderInlineMarkdown(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="border border-[rgba(255,255,255,0.05)] px-5 py-3 text-[#2d3748] text-[0.9375rem]">
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };

    const renderInlineMarkdown = (text: string): React.ReactElement => {
      // Escape HTML first
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      // Process code first (to avoid conflicts)
      html = html.replace(/`([^`]+)`/g, '<code class="bg-[rgba(0,0,0,0.1)] px-1 py-0.5 rounded text-xs font-mono">$1</code>');
      // Process bold
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // Process italic (single asterisk, not part of bold)
      html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
      
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
    };

    lines.forEach((line, idx) => {
      const trimmedLine = line.trim();
      
      // Check for table
      if (trimmedLine.includes('|') && trimmedLine.split('|').length > 2) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        tableRows.push(trimmedLine);
        return;
      } else {
        if (inTable && tableRows.length > 0) {
          const table = processTable();
          if (table) elements.push(table);
          tableRows = [];
          inTable = false;
        }
      }

      // Blockquote
      if (trimmedLine.startsWith('>')) {
        if (!inBlockquote) {
          inBlockquote = true;
          blockquoteContent = [];
        }
        blockquoteContent.push(trimmedLine.substring(1).trim());
        return;
      } else {
        if (inBlockquote && blockquoteContent.length > 0) {
          elements.push(
            <blockquote key={`blockquote-${elements.length}`} className="border-l-4 border-[rgba(255,107,53,0.5)] pl-4 my-4 italic text-[#4a5568] bg-[rgba(255,255,255,0.05)] py-2 rounded-r">
              {blockquoteContent.map((content, i) => (
                <p key={i} className="m-0 mb-2 last:mb-0">
                  {renderInlineMarkdown(content)}
                </p>
              ))}
            </blockquote>
          );
          blockquoteContent = [];
          inBlockquote = false;
        }
      }

      // Headers
      if (trimmedLine.startsWith('###')) {
        elements.push(
          <h3 key={`h3-${idx}`} className="text-xl font-bold text-[#ff6b35] mt-8 mb-4 pt-2">
            {trimmedLine.substring(3).trim().replace(/\*\*/g, '')}
          </h3>
        );
        return;
      }
      if (trimmedLine.startsWith('##')) {
        elements.push(
          <h2 key={`h2-${idx}`} className="text-2xl font-bold text-[#ff6b35] mt-10 mb-5 pt-3 border-b border-[rgba(255,107,53,0.2)] pb-2">
            {trimmedLine.substring(2).trim().replace(/\*\*/g, '')}
          </h2>
        );
        return;
      }
      if (trimmedLine.startsWith('#')) {
        elements.push(
          <h1 key={`h1-${idx}`} className="text-3xl font-bold text-[#ff6b35] mt-10 mb-6 pt-4">
            {trimmedLine.substring(1).trim().replace(/\*\*/g, '')}
          </h1>
        );
        return;
      }

      // Lists
      if (trimmedLine.match(/^\d+\./)) {
        currentList.push(trimmedLine);
        return;
      } else if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        currentList.push(trimmedLine);
        return;
      } else {
        if (currentList.length > 0) {
          const isOrdered = currentList[0].match(/^\d+\./);
          elements.push(
            isOrdered ? (
              <ol key={`list-${elements.length}`} className="list-decimal list-outside my-5 ml-6 space-y-3 text-[#2d3748] leading-relaxed">
                {currentList.map((item, i) => (
                  <li key={i} className="pl-2 mb-2">
                    {renderInlineMarkdown(item.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, ''))}
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={`list-${elements.length}`} className="list-disc list-outside my-5 ml-6 space-y-3 text-[#2d3748] leading-relaxed">
                {currentList.map((item, i) => (
                  <li key={i} className="pl-2 mb-2">
                    {renderInlineMarkdown(item.replace(/^[-*]\s*/, ''))}
                  </li>
                ))}
              </ul>
            )
          );
          currentList = [];
        }
      }

      // Horizontal rule
      if (trimmedLine.match(/^---+$/)) {
        elements.push(
          <hr key={`hr-${idx}`} className="my-6 border-0 border-t border-[rgba(255,107,53,0.3)]" />
        );
        return;
      }

      // Regular paragraphs (only if not empty and not a special markdown element)
      if (trimmedLine && 
          !trimmedLine.startsWith('>') && 
          !trimmedLine.startsWith('|') && 
          !trimmedLine.startsWith('#') &&
          !trimmedLine.match(/^\d+\./) &&
          !trimmedLine.startsWith('-') &&
          !trimmedLine.startsWith('*') &&
          !trimmedLine.match(/^---+$/)) {
        elements.push(
          <p key={`p-${idx}`} className="mb-4 text-[#2d3748] leading-[1.8] text-[1rem]">
            {renderInlineMarkdown(trimmedLine)}
          </p>
        );
      }
    });

    // Process any remaining elements
    if (inTable && tableRows.length > 0) {
      const table = processTable();
      if (table) elements.push(table);
    }
    if (inBlockquote && blockquoteContent.length > 0) {
      elements.push(
        <blockquote key={`blockquote-${elements.length}`} className="border-l-4 border-[rgba(255,107,53,0.5)] pl-4 my-4 italic text-[#4a5568] bg-[rgba(255,255,255,0.05)] py-2 rounded-r">
          {blockquoteContent.map((content, i) => (
            <p key={i} className="m-0 mb-2 last:mb-0">
              {renderInlineMarkdown(content)}
            </p>
          ))}
        </blockquote>
      );
    }
    if (currentList.length > 0) {
      const isOrdered = currentList[0].match(/^\d+\./);
      elements.push(
        isOrdered ? (
          <ol key={`list-${elements.length}`} className="list-decimal list-outside my-5 ml-6 space-y-3 text-[#2d3748] leading-relaxed">
            {currentList.map((item, i) => (
              <li key={i} className="pl-2 mb-2">
                {renderInlineMarkdown(item.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, ''))}
              </li>
            ))}
          </ol>
        ) : (
          <ul key={`list-${elements.length}`} className="list-disc list-outside my-5 ml-6 space-y-3 text-[#2d3748] leading-relaxed">
            {currentList.map((item, i) => (
              <li key={i} className="pl-2 mb-2">
                {renderInlineMarkdown(item.replace(/^[-*]\s*/, ''))}
              </li>
            ))}
          </ul>
        )
      );
    }

    return <div>{elements}</div>;
  };

  return renderMarkdown(text);
}

interface Message {
  text: string;
  isUser: boolean;
}

interface FileItem {
  file: File;
  id: string;
}

export default function Home() {
  const [activePage, setActivePage] = useState('description');
  const [messages, setMessages] = useState<Message[]>([
    {
      text: "Hello! 👋 I'm NYAAYBOT, your friendly guide to constitutions from around the world! I'm here to help you understand constitutional law in a simple and approachable way. Feel free to ask me about any country's constitution, including articles, amendments, fundamental rights, constitutional provisions, or comparative analysis. What would you like to learn about today? 😊",
      isUser: false,
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileItem[]>([]);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('India');
  const [aiStats, setAiStats] = useState<{
    severity: string;
    confidence: number;
    timeTaken: number;
    summary: string;
    court: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Filter profanity from user message
    let userMessage = inputMessage.trim();
    const filteredMessage = filter.clean(userMessage);
    
    // Use filtered message for display and API
    userMessage = filteredMessage;
    setInputMessage('');
    setMessages((prev) => [...prev, { text: userMessage, isUser: true }]);
    setIsLoading(true);

    try {
      const conversationHistory = messages
        .slice(1) // Skip the initial bot message
        .map((msg) => ({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.text,
        }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { text: data.message, isUser: false }]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get response. Please ensure Ollama is running and the gpt-oss:120b-cloud model is available.';
      setMessages((prev) => [
        ...prev,
        {
          text: `Error: ${errorMessage}`,
          isUser: false,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles: FileItem[] = files.map((file) => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAnalyze = async () => {
    if (uploadedFiles.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAiStats(null);

    try {
      const formData = new FormData();
      uploadedFiles.forEach((item) => {
        formData.append('files', item.file);
      });
      formData.append('country', selectedCountry);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze documents');
      }

      const data = await response.json();
      setAnalysisResult(data.analysis);
      if (data.stats) {
        setAiStats(data.stats);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze documents. Please ensure Ollama is running and the gpt-oss:120b-cloud model is available.';
      setAnalysisResult(`Error: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="header">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center flex-wrap gap-4 header-content">
          <div className="flex items-center gap-4 logo-section">
            <div className="text-4xl">⚖️</div>
            <div>
              <h1 className="text-[1.75rem] font-bold text-[#ff6b35] m-0 tracking-wide site-title">NYAAYBOT</h1>
              <p className="text-sm text-[#4a5568] m-0 tagline">Your AI-Powered Legal Assistant</p>
            </div>
          </div>
          <nav className="flex gap-3 flex-wrap nav-buttons">
              {[
                { id: 'description', label: 'HOME' },
                { id: 'chatbot', label: 'NYAAY AI' },
                { id: 'case-analysis', label: 'CASE ANALYSIS' },
                { id: 'author', label: 'ABOUT' },
              ].map((page) => (
              <button
                key={page.id}
                onClick={() => setActivePage(page.id)}
                className={`nav-btn px-6 py-3 rounded-full border text-sm font-medium ${
                  activePage === page.id
                    ? 'bg-[rgba(255,107,53,0.15)] text-[#ff6b35] border-[rgba(255,107,53,0.3)] shadow-[0_4px_15px_rgba(255,107,53,0.2)]'
                    : 'bg-[rgba(255,255,255,0.1)] text-[#1a202c] border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,107,53,0.2)] hover:text-[#ff6b35] hover:border-[rgba(255,107,53,0.4)]'
                }`}
              >
                {page.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content max-w-[1400px] mx-auto px-8 py-12 min-h-[calc(100%-100px)]">
        {/* Description Page */}
        {activePage === 'description' && (
          <div className="max-w-[900px] mx-auto animate-fadeIn">
            <h2 className="text-[2.5rem] font-bold text-[#ff6b35] text-center mb-6">About NYAAYBOT</h2>
            <div className="description-card bg-[rgba(255,255,255,0.25)] backdrop-blur-[25px] border border-[rgba(255,255,255,0.3)] rounded-[24px] p-12 mb-12 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)]">
              <p className="text-lg text-[#4a5568] leading-[1.8] mb-6">
                NYAAYBOT is an AI-powered legal assistant built to make Indian law easier to understand, access, and apply. It serves as a practical resource for law students, legal professionals, and everyday citizens who want clear and reliable legal knowledge without complexity.
              </p>
              <p className="text-lg text-[#4a5568] leading-[1.8] mb-6">
                The platform provides simplified explanations of the Constitution of India, core legal principles, and rights and duties of individuals. Instead of searching through dense legal texts, users can ask direct questions and receive structured, accurate answers tailored to their needs.
              </p>
              <p className="text-lg text-[#4a5568] leading-[1.8] mb-6">
                NYAAYBOT also assists in analyzing legal documents, offering guidance in interpretation, clarity in terminology, and support for research-based queries. This helps users understand what legal documents actually mean and how laws are applied in real situations.
              </p>
              <p className="text-lg text-[#4a5568] leading-[1.8]">
                By combining advanced AI technology with well-grounded legal understanding, NYAAYBOT bridges the gap between legal language and practical comprehension. It empowers users to learn, review, and engage with Indian law more confidently and efficiently.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: '📚', title: 'Constitution Knowledge', desc: 'Interactive chatbot trained on the Indian Constitution to answer your questions instantly' },
                { icon: '📄', title: 'Document Analysis', desc: 'Upload legal documents in any format for AI-powered analysis and insights' },
                { icon: '🔍', title: 'OCR Support', desc: 'Advanced OCR technology to extract text from scanned documents and images' },
                { icon: '⚡', title: 'Instant Results', desc: 'Get quick, accurate legal information and document analysis in seconds' },
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className="feature-card bg-[rgba(255,255,255,0.18)] backdrop-blur-[20px] p-8 rounded-[20px] border border-[rgba(255,255,255,0.25)]"
                >
                  <div className="text-[2.5rem] mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-[#2d3748] mb-2">{feature.title}</h3>
                  <p className="text-[#4a5568] leading-[1.6] text-[0.9375rem]">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chatbot Page */}
        {activePage === 'chatbot' && (
          <div className="max-w-[1000px] mx-auto h-[70%] flex flex-col chatbot-container">
            <div className="bg-[rgba(255,255,255,0.2)] backdrop-blur-[25px] p-8 rounded-t-[24px] border border-[rgba(255,255,255,0.3)] border-b-0 chat-header">
              <h2 className="text-2xl font-semibold text-[#ff6b35] mb-2 m-0">NYAAY AI</h2>
              <p className="text-[#4a5568] m-0 opacity-80 text-[0.9375rem]">Ask me anything about constitutions from around the world</p>
            </div>
            <div className="chat-messages flex-1 bg-[rgba(255,255,255,0.15)] backdrop-blur-[20px] border-x border-[rgba(255,255,255,0.3)] p-8 min-h-[400px] max-h-[500px] overflow-y-auto">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`message flex gap-4 mb-6 ${msg.isUser ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`message-avatar w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                      msg.isUser
                        ? 'bg-gradient-to-br from-[#4299e1] to-[#63b3ed]'
                        : 'bg-gradient-to-br from-[#ff6b35] to-[#ff8c42]'
                    }`}
                  >
                    {msg.isUser ? '👤' : '🤖'}
                  </div>
                  <div
                    className={`message-content max-w-[70%] p-5 rounded-[20px] backdrop-blur-[10px] border ${
                      msg.isUser
                        ? 'bg-[rgba(66,153,225,0.15)] border-[rgba(66,153,225,0.3)]'
                        : 'bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)]'
                    }`}
                  >
                    {msg.isUser ? (
                      <p className="message-text m-0 leading-[1.6] text-[#2d3748] whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <div className="message-text text-[#2d3748]">
                        <MarkdownRenderer text={msg.text} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message flex gap-4 mb-6">
                  <div className="message-avatar w-10 h-10 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ff8c42] flex items-center justify-center text-xl flex-shrink-0">
                    🤖
                  </div>
                  <div className="message-content bg-[rgba(255,255,255,0.1)] backdrop-blur-[10px] border border-[rgba(255,255,255,0.2)] p-5 rounded-[20px]">
                    <p className="message-text m-0 text-[#4a5568]">Thinking...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="bg-[rgba(255,255,255,0.2)] backdrop-blur-[25px] p-8 rounded-b-[24px] border border-[rgba(255,255,255,0.3)] border-t-0 chat-input-container">
              <div className="flex gap-4 chat-input-wrapper">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your question about any country's constitution..."
                  className="chat-input flex-1 px-6 py-4 bg-[rgba(255,255,255,0.1)] backdrop-blur-[10px] border border-[rgba(255,255,255,0.2)] rounded-full text-[#1a202c] text-base outline-none focus:border-[rgba(255,107,53,0.4)] focus:shadow-[0_0_0_3px_rgba(255,107,53,0.1)]"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputMessage.trim()}
                  className="send-btn px-8 py-4 bg-[rgba(255,107,53,0.2)] backdrop-blur-[10px] text-[#ff6b35] border border-[rgba(255,107,53,0.3)] rounded-full font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Case Analysis Page */}
        {activePage === 'case-analysis' && (
          <div className="max-w-[1000px] mx-auto">
            <h2 className="text-[2.5rem] font-bold text-[#ff6b35] text-center mb-8">Case Document Analysis</h2>
            <div className="description-card bg-[rgba(255,255,255,0.25)] backdrop-blur-[25px] border border-[rgba(255,255,255,0.3)] rounded-[24px] p-12 mb-8">
              <p className="text-lg text-[#4a5568] leading-[1.8] mb-6">
                Upload legal documents for AI-powered analysis. Our system supports all file formats including PDFs, Word documents, images, and scanned documents with OCR capabilities.
              </p>
              <div className="flex items-center gap-4">
                <label htmlFor="countrySelect" className="text-lg font-semibold text-[#2d3748]">
                  Choose Country:
                </label>
                <select
                  id="countrySelect"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="px-6 py-3 bg-[rgba(255,255,255,0.2)] backdrop-blur-[10px] border border-[rgba(255,255,255,0.3)] rounded-full text-[#2d3748] font-medium text-base outline-none focus:border-[rgba(255,107,53,0.4)] focus:shadow-[0_0_0_3px_rgba(255,107,53,0.1)] cursor-pointer"
                  disabled={isAnalyzing}
                >
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Canada">Canada</option>
                  <option value="Australia">Australia</option>
                  <option value="Germany">Germany</option>
                  <option value="France">France</option>
                  <option value="Japan">Japan</option>
                  <option value="Brazil">Brazil</option>
                  <option value="South Africa">South Africa</option>
                  <option value="Ireland">Ireland</option>
                  <option value="New Zealand">New Zealand</option>
                  <option value="Spain">Spain</option>
                  <option value="Italy">Italy</option>
                  <option value="China">China</option>
                  <option value="Pakistan">Pakistan</option>
                  <option value="Bangladesh">Bangladesh</option>
                  <option value="Sri Lanka">Sri Lanka</option>
                  <option value="Nepal">Nepal</option>
                </select>
              </div>
            </div>
            <div className="upload-section bg-[rgba(255,255,255,0.18)] backdrop-blur-[25px] border-2 border-dashed border-[rgba(72,187,120,0.3)] rounded-[24px] p-16 text-center mb-8">
              <div className="text-6xl mb-4 upload-icon">📁</div>
              <h3 className="text-2xl font-semibold text-[#48bb78] mb-2 upload-title">Upload Your Documents</h3>
              <p className="text-[#4a5568] mb-6 text-base">Supports PDF, DOC, DOCX, images (JPG, PNG), and scanned documents</p>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.gif,.bmp,.webp"
                className="hidden"
                id="fileInput"
              />
              <label
                htmlFor="fileInput"
                className="file-input-label inline-block px-8 py-4 bg-[rgba(72,187,120,0.2)] backdrop-blur-[10px] text-[#48bb78] border border-[rgba(72,187,120,0.3)] rounded-full font-semibold cursor-pointer text-base"
              >
                Choose Files
              </label>
              {uploadedFiles.length > 0 && (
                <div className="mt-8 space-y-3">
                  {uploadedFiles.map((item) => (
                    <div
                      key={item.id}
                      className="file-item bg-[rgba(255,255,255,0.1)] backdrop-blur-[15px] p-5 rounded-[16px] flex justify-between items-center border border-[rgba(255,255,255,0.2)]"
                    >
                      <span className="text-[#2d3748] text-[0.9375rem]">
                        📄 {item.file.name} ({(item.file.size / 1024).toFixed(2)} KB)
                      </span>
                      <button
                        onClick={() => handleRemoveFile(item.id)}
                        className="px-4 py-2 bg-[#ef4444] text-white rounded-lg hover:bg-[#dc2626] transition-colors text-sm border-none cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleAnalyze}
              disabled={uploadedFiles.length === 0 || isAnalyzing}
              className="analyze-btn block mx-auto px-12 py-5 bg-[rgba(255,107,53,0.2)] backdrop-blur-[15px] text-[#ff6b35] border border-[rgba(255,107,53,0.3)] rounded-full font-semibold text-lg disabled:bg-[rgba(203,213,224,0.2)] disabled:text-[#a0aec0] disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Documents'}
            </button>
            {analysisResult && (
              <div className="mt-12 bg-[rgba(255,255,255,0.25)] backdrop-blur-[25px] border border-[rgba(255,255,255,0.3)] rounded-[24px] p-12 animate-slideUp shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)]">
                <h3 className="text-2xl font-semibold text-[#ff6b35] mb-6">Analysis Results</h3>
                
                {/* AI Stats Section */}
                {aiStats && (
                  <>
                    <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-[rgba(255,107,53,0.1)] backdrop-blur-[15px] border border-[rgba(255,107,53,0.2)] rounded-[16px] p-6">
                        <div className="text-sm text-[#4a5568] mb-2 font-medium">Case Severity</div>
                        <div className="text-2xl font-bold text-[#ff6b35]">{aiStats.severity}</div>
                      </div>
                      <div className="bg-[rgba(66,153,225,0.1)] backdrop-blur-[15px] border border-[rgba(66,153,225,0.2)] rounded-[16px] p-6">
                        <div className="text-sm text-[#4a5568] mb-2 font-medium">AI Confidence</div>
                        <div className="text-2xl font-bold text-[#4299e1]">{aiStats.confidence}%</div>
                      </div>
                      <div className="bg-[rgba(72,187,120,0.1)] backdrop-blur-[15px] border border-[rgba(72,187,120,0.2)] rounded-[16px] p-6">
                        <div className="text-sm text-[#4a5568] mb-2 font-medium">Time Taken</div>
                        <div className="text-2xl font-bold text-[#48bb78]">{aiStats.timeTaken}s</div>
                      </div>
                    </div>
                    
                    {/* Case Summary Section */}
                    {aiStats.summary && (
                      <div className="mb-8 bg-[rgba(139,92,246,0.1)] backdrop-blur-[15px] border border-[rgba(139,92,246,0.2)] rounded-[16px] p-6">
                        <div className="text-lg font-semibold text-[#8b5cf6] mb-3 flex items-center gap-2">
                          <span>📋</span>
                          <span>Case Summary</span>
                        </div>
                        <div className="text-[#4a5568] leading-[1.8] text-base">{aiStats.summary}</div>
                      </div>
                    )}
                    
                    {/* Recommended Court Section */}
                    {aiStats.court && (
                      <div className="mb-8 bg-[rgba(251,146,60,0.1)] backdrop-blur-[15px] border border-[rgba(251,146,60,0.2)] rounded-[16px] p-6">
                        <div className="text-lg font-semibold text-[#fb923c] mb-3 flex items-center gap-2">
                          <span>⚖️</span>
                          <span>Recommended Court</span>
                        </div>
                        <div className="text-[#2d3748] leading-[1.8] text-lg font-medium">{aiStats.court}</div>
                        <div className="text-sm text-[#4a5568] mt-2 italic">Based on case severity: {aiStats.severity}</div>
                      </div>
                    )}
                  </>
                )}
                
                <div className="text-[#2d3748] leading-[1.8] text-[1rem] analysis-content">
                  <MarkdownRenderer text={analysisResult} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Author Page */}
        {activePage === 'author' && (
          <div className="max-w-[1200px] mx-auto">
            <h2 className="text-[2.5rem] font-bold text-[#ff6b35] text-center mb-8">About the Creators</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                {
                  avatar: '/Authors/AyushDas.jpeg',
                  name: 'Ayush Das',
                  bio: 'A passionate developer, tech enthusiast and a student dedicated to making legal information accessible to everyone. NYAAYBOT was created to bridge the gap between complex legal systems and everyday citizens, empowering people with knowledge about their constitutional rights and legal processes.',
                  links: [
                    { label: '🔗 LinkedIn', href: 'https://www.linkedin.com/in/ayush-das-11121a337/' },
                    { label: '💻 GitHub', href: 'https://github.com/ayush-kumar-21' },
                    { label: '📧 Email', href: 'mailto:ayushdaskumar1@gmail.com' },
                  ],
                },
                {
                  avatar: '/Authors/SaiSwarup.png',
                  name: 'Sai Swarup Shroff',
                  bio: 'A passionate developer, tech enthusiast and a student dedicated to making legal information accessible to everyone. NYAAYBOT was created to bridge the gap between complex legal systems and everyday citizens, empowering people with knowledge about their constitutional rights and legal processes.',
                  links: [
                    { label: '🔗 LinkedIn', href: 'https://www.linkedin.com/in/sai-swarup-shroff-3b5270322' },
                    { label: '💻 GitHub', href: 'https://github.com/shroff45' },
                    { label: '📧 Email', href: 'mailto:sswarup.sai@gmail.com' },
                  ],
                },
              ].map((author, idx) => (
                <div
                  key={idx}
                  className="author-card bg-[rgba(255,255,255,0.25)] backdrop-blur-[25px] border border-[rgba(255,255,255,0.3)] rounded-[24px] p-16 text-center shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)]"
                >
                  <div className="author-avatar w-[150px] h-[150px] bg-gradient-to-br from-[rgba(255,107,53,0.3)] to-[rgba(255,140,66,0.3)] backdrop-blur-[15px] rounded-full flex items-center justify-center text-6xl mx-auto mb-8 border-2 border-[rgba(255,255,255,0.3)] overflow-hidden relative">
                    {author.avatar && author.avatar.startsWith('/') ? (
                      <img 
                        src={author.avatar} 
                        alt={author.name}
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('span')) {
                            const fallback = document.createElement('span');
                            fallback.textContent = '👨‍💻';
                            fallback.className = 'text-6xl';
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <span>{author.avatar}</span>
                    )}
                  </div>
                  <h3 className="text-3xl font-bold text-[#ff6b35] mb-4">{author.name}</h3>
                  <p className="text-lg text-[#4a5568] leading-[1.8] mb-8">
                    {author.bio}
                  </p>
                  <div className="flex gap-4 justify-center flex-wrap">
                    {author.links.map((link, linkIdx) => (
                      <a
                        key={linkIdx}
                        href={link.href}
                        target={link.href.startsWith('http') || link.href.startsWith('mailto') ? '_blank' : undefined}
                        rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="author-link px-6 py-3 bg-[rgba(255,255,255,0.1)] backdrop-blur-[10px] text-[#1a202c] border border-[rgba(255,255,255,0.2)] rounded-full text-[0.9375rem] no-underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
