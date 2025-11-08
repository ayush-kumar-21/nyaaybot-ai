'use client';

import { useState, useRef, useEffect } from 'react';

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
      text: "Hello! I'm NYAAYBOT, your guide to the Indian Constitution. Ask me about fundamental rights, directive principles, amendments, or any constitutional provision. How can I help you today?",
      isUser: false,
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileItem[]>([]);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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

    const userMessage = inputMessage.trim();
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to get response. Please ensure Ollama is running with the gpt-oss:20b model.';
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

    try {
      const formData = new FormData();
      uploadedFiles.forEach((item) => {
        formData.append('files', item.file);
      });

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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze documents. Please ensure Ollama is running with the gpt-oss:20b model.';
      setAnalysisResult(`Error: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/10 backdrop-blur-xl border-b border-orange-200/20 shadow-lg">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="text-4xl">⚖️</div>
              <div>
                <h1 className="text-3xl font-bold text-orange-500 tracking-wide">NYAAYBOT</h1>
                <p className="text-sm text-gray-600">Your AI-Powered Legal Assistant</p>
              </div>
            </div>
            <nav className="flex gap-3 flex-wrap">
              {[
                { id: 'description', label: 'Description' },
                { id: 'chatbot', label: 'Constitution Chatbot' },
                { id: 'case-analysis', label: 'Case Analysis' },
                { id: 'author', label: 'About Author' },
              ].map((page) => (
                <button
                  key={page.id}
                  onClick={() => setActivePage(page.id)}
                  className={`px-6 py-3 rounded-full border transition-all ${
                    activePage === page.id
                      ? 'bg-orange-500/20 text-orange-500 border-orange-500/30 shadow-md'
                      : 'bg-white/10 text-gray-700 border-white/20 hover:bg-orange-500/10 hover:border-orange-500/20'
                  }`}
                >
                  {page.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Description Page */}
        {activePage === 'description' && (
          <div className="max-w-4xl mx-auto animate-fadeIn">
            <h2 className="text-4xl font-bold text-orange-500 text-center mb-8">About NYAAYBOT</h2>
            <div className="bg-white/25 backdrop-blur-xl border border-white/30 rounded-3xl p-12 mb-12 shadow-xl">
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                NYAAYBOT is your comprehensive AI-powered legal assistant designed to make understanding Indian law accessible to everyone. Whether you&apos;re a law student, legal professional, or citizen seeking to understand your rights, NYAAYBOT provides intelligent tools to navigate the complexities of the Indian legal system.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Our platform combines cutting-edge artificial intelligence with deep legal knowledge to provide accurate, reliable information about the Constitution of India and help analyze legal documents with unprecedented ease.
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
                  className="bg-white/18 backdrop-blur-xl p-8 rounded-2xl border border-white/25 hover:scale-105 hover:shadow-xl transition-all"
                >
                  <div className="text-5xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chatbot Page */}
        {activePage === 'chatbot' && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-t-3xl p-8">
              <h2 className="text-2xl font-semibold text-orange-500 mb-2">Constitution Chatbot</h2>
              <p className="text-gray-600">Ask me anything about the Indian Constitution</p>
            </div>
            <div className="bg-white/15 backdrop-blur-xl border-x border-white/30 p-8 min-h-[400px] max-h-[500px] overflow-y-auto">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-4 mb-6 ${msg.isUser ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                      msg.isUser
                        ? 'bg-gradient-to-br from-blue-400 to-blue-500'
                        : 'bg-gradient-to-br from-orange-400 to-orange-500'
                    }`}
                  >
                    {msg.isUser ? '👤' : '🤖'}
                  </div>
                  <div
                    className={`max-w-[70%] p-5 rounded-2xl backdrop-blur-md border ${
                      msg.isUser
                        ? 'bg-blue-500/15 border-blue-500/30'
                        : 'bg-white/10 border-white/20'
                    }`}
                  >
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4 mb-6">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-xl flex-shrink-0">
                    🤖
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl">
                    <p className="text-gray-600">Thinking...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-b-3xl p-8">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your question about the Constitution..."
                  className="flex-1 px-6 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-gray-800 placeholder-gray-500 focus:outline-none focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/20"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputMessage.trim()}
                  className="px-8 py-4 bg-orange-500/20 backdrop-blur-md text-orange-500 border border-orange-500/30 rounded-full font-semibold hover:bg-orange-500/30 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Case Analysis Page */}
        {activePage === 'case-analysis' && (
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl font-bold text-orange-500 text-center mb-8">Case Document Analysis</h2>
            <div className="bg-white/25 backdrop-blur-xl border border-white/30 rounded-3xl p-12 mb-8">
              <p className="text-lg text-gray-700 leading-relaxed">
                Upload legal documents for AI-powered analysis. Our system supports all file formats including PDFs, Word documents, images, and scanned documents with OCR capabilities.
              </p>
            </div>
            <div className="bg-white/18 backdrop-blur-xl border-2 border-dashed border-green-400/30 rounded-3xl p-16 text-center mb-8 hover:border-green-400/50 transition-all">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-2xl font-semibold text-green-600 mb-2">Upload Your Documents</h3>
              <p className="text-gray-600 mb-6">Supports PDF, DOC, DOCX, images (JPG, PNG), and scanned documents</p>
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
                className="inline-block px-8 py-4 bg-green-500/20 backdrop-blur-md text-green-600 border border-green-500/30 rounded-full font-semibold cursor-pointer hover:bg-green-500/30 hover:scale-105 transition-all"
              >
                Choose Files
              </label>
              {uploadedFiles.length > 0 && (
                <div className="mt-8 space-y-3">
                  {uploadedFiles.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white/10 backdrop-blur-md p-4 rounded-2xl flex justify-between items-center border border-white/20"
                    >
                      <span className="text-gray-700">
                        📄 {item.file.name} ({(item.file.size / 1024).toFixed(2)} KB)
                      </span>
                      <button
                        onClick={() => handleRemoveFile(item.id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
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
              className="block mx-auto px-12 py-4 bg-orange-500/20 backdrop-blur-md text-orange-500 border border-orange-500/30 rounded-full font-semibold text-lg hover:bg-orange-500/30 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Documents'}
            </button>
            {analysisResult && (
              <div className="mt-12 bg-white/25 backdrop-blur-xl border border-white/30 rounded-3xl p-12 animate-slideUp">
                <h3 className="text-2xl font-semibold text-orange-500 mb-4">Analysis Results</h3>
                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">{analysisResult}</div>
              </div>
            )}
          </div>
        )}

        {/* Author Page */}
        {activePage === 'author' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-orange-500 text-center mb-8">About the Creator</h2>
            <div className="bg-white/25 backdrop-blur-xl border border-white/30 rounded-3xl p-16 text-center">
              <div className="w-40 h-40 bg-gradient-to-br from-orange-400/30 to-orange-500/30 backdrop-blur-md rounded-full flex items-center justify-center text-6xl mx-auto mb-8 border-2 border-white/30">
                👨‍💻
              </div>
              <h3 className="text-3xl font-bold text-orange-500 mb-4">Your Name</h3>
              <p className="text-lg text-gray-700 leading-relaxed mb-8">
                A passionate developer and legal tech enthusiast dedicated to making legal information accessible to everyone. NYAAYBOT was created to bridge the gap between complex legal systems and everyday citizens, empowering people with knowledge about their constitutional rights and legal processes.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                {['🔗 LinkedIn', '💻 GitHub', '📧 Email'].map((link, idx) => (
                  <a
                    key={idx}
                    href="#"
                    className="px-6 py-3 bg-white/10 backdrop-blur-md text-gray-700 border border-white/20 rounded-full hover:bg-orange-500/20 hover:text-orange-500 hover:border-orange-500/30 transition-all"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease;
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
}
