import { NextRequest, NextResponse } from 'next/server';
import { Ollama } from 'ollama';
import { createWorker } from 'tesseract.js';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import sharp from 'sharp';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
});

// Model configuration - can be overridden via environment variable
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud';
// Alternative model for reference: 'gpt-oss:20b'

// Extract text from PDF
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
}

// Extract text from DOCX
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(`Failed to extract text from DOCX: ${error}`);
  }
}

// Extract text from image using OCR
async function extractTextFromImage(buffer: Buffer): Promise<string> {
  try {
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    return text;
  } catch (error) {
    throw new Error(`Failed to extract text from image using OCR: ${error}`);
  }
}

// Extract text from plain text file
async function extractTextFromTXT(buffer: Buffer): Promise<string> {
  return buffer.toString('utf-8');
}

// Process file based on its type
async function processFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = file.name.toLowerCase();
  const fileType = file.type;

  // Determine file type and extract text
  if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
    return await extractTextFromPDF(buffer);
  } else if (
    fileName.endsWith('.docx') ||
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return await extractTextFromDOCX(buffer);
  } else if (
    fileName.endsWith('.doc') ||
    fileType === 'application/msword'
  ) {
    // .doc files (binary format) are not fully supported
    // Suggest converting to DOCX or PDF
    throw new Error('DOC files (binary format) are not fully supported. Please convert to DOCX or PDF format for better compatibility.');
  } else if (
    fileName.endsWith('.txt') ||
    fileType === 'text/plain'
  ) {
    return await extractTextFromTXT(buffer);
  } else if (
    fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) ||
    fileType.startsWith('image/')
  ) {
    // Process image with OCR
    // First, optimize the image if needed
    let processedBuffer = buffer;
    try {
      processedBuffer = await sharp(buffer)
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .sharpen()
        .toBuffer();
    } catch (error) {
      // If sharp fails, use original buffer
      console.warn('Image optimization failed, using original:', error);
    }
    return await extractTextFromImage(processedBuffer);
  } else {
    // Try OCR as fallback for unknown file types
    try {
      return await extractTextFromImage(buffer);
    } catch (error) {
      throw new Error(`Unsupported file type: ${fileType || 'unknown'}`);
    }
  }
}

// Calculate case severity based on keywords and content
function calculateSeverity(text: string): string {
  const lowerText = text.toLowerCase();
  
  // High severity keywords
  const highSeverityKeywords = [
    'murder', 'homicide', 'rape', 'assault', 'violence', 'terrorism', 'treason',
    'fraud', 'corruption', 'embezzlement', 'money laundering', 'drug trafficking',
    'kidnapping', 'extortion', 'blackmail', 'conspiracy', 'organized crime'
  ];
  
  // Medium severity keywords
  const mediumSeverityKeywords = [
    'theft', 'robbery', 'burglary', 'vandalism', 'arson', 'battery',
    'defamation', 'harassment', 'discrimination', 'breach of contract',
    'negligence', 'malpractice', 'tax evasion', 'copyright infringement'
  ];
  
  // Low severity keywords
  const lowSeverityKeywords = [
    'traffic violation', 'parking ticket', 'noise complaint', 'trespassing',
    'petty theft', 'disorderly conduct', 'loitering', 'jaywalking'
  ];
  
  const highCount = highSeverityKeywords.filter(keyword => lowerText.includes(keyword)).length;
  const mediumCount = mediumSeverityKeywords.filter(keyword => lowerText.includes(keyword)).length;
  const lowCount = lowSeverityKeywords.filter(keyword => lowerText.includes(keyword)).length;
  
  if (highCount > 0 || (highCount === 0 && mediumCount >= 3)) {
    return 'High';
  } else if (mediumCount > 0 || (mediumCount === 0 && lowCount >= 2)) {
    return 'Medium';
  } else if (lowCount > 0) {
    return 'Low';
  } else {
    // Default based on document length and complexity
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 5000) return 'Medium';
    if (wordCount > 1000) return 'Low';
    return 'Low';
  }
}

// Calculate AI confidence based on analysis quality
function calculateConfidence(text: string, analysis: string): number {
  // Base confidence
  let confidence = 75;
  
  // Increase confidence if analysis is detailed
  const analysisWords = analysis.split(/\s+/).length;
  if (analysisWords > 500) confidence += 10;
  if (analysisWords > 1000) confidence += 5;
  
  // Increase confidence if analysis contains legal terms
  const legalTerms = ['article', 'section', 'clause', 'provision', 'amendment', 'constitution', 'law', 'legal', 'right', 'duty'];
  const legalTermCount = legalTerms.filter(term => analysis.toLowerCase().includes(term)).length;
  confidence += Math.min(legalTermCount * 2, 10);
  
  // Decrease confidence if analysis is too short
  if (analysisWords < 100) confidence -= 15;
  if (analysisWords < 50) confidence -= 10;
  
  // Ensure confidence is between 50 and 95
  return Math.max(50, Math.min(95, confidence));
}

// Determine the court based on severity and country
function determineCourt(severity: string, country: string): string {
  const countryLower = country.toLowerCase();
  
  // India-specific courts
  if (countryLower === 'india') {
    if (severity === 'High') {
      return 'Supreme Court of India or High Court';
    } else if (severity === 'Medium') {
      return 'High Court or District Court';
    } else {
      return 'District Court or Magistrate Court';
    }
  }
  
  // United States-specific courts
  if (countryLower === 'united states' || countryLower === 'usa' || countryLower === 'us') {
    if (severity === 'High') {
      return 'Federal District Court or Supreme Court';
    } else if (severity === 'Medium') {
      return 'State Superior Court or Federal District Court';
    } else {
      return 'State Court or Municipal Court';
    }
  }
  
  // United Kingdom-specific courts
  if (countryLower === 'united kingdom' || countryLower === 'uk' || countryLower === 'britain') {
    if (severity === 'High') {
      return 'High Court of Justice or Supreme Court';
    } else if (severity === 'Medium') {
      return 'Crown Court or County Court';
    } else {
      return 'Magistrates\' Court or County Court';
    }
  }
  
  // Canada-specific courts
  if (countryLower === 'canada') {
    if (severity === 'High') {
      return 'Supreme Court of Canada or Provincial Superior Court';
    } else if (severity === 'Medium') {
      return 'Provincial Court or Superior Court';
    } else {
      return 'Provincial Court or Small Claims Court';
    }
  }
  
  // Australia-specific courts
  if (countryLower === 'australia') {
    if (severity === 'High') {
      return 'High Court of Australia or Federal Court';
    } else if (severity === 'Medium') {
      return 'State Supreme Court or District Court';
    } else {
      return 'Local Court or Magistrates Court';
    }
  }
  
  // Generic/default court structure
  if (severity === 'High') {
    return 'Supreme Court or High Court';
  } else if (severity === 'Medium') {
    return 'High Court or District Court';
  } else {
    return 'District Court or Lower Court';
  }
}

// Generate a concise summary from the analysis
function generateSummary(analysis: string, combinedText: string): string {
  // Try to extract a simple summary from the analysis
  // Look for the "What This Case Is About" section or first paragraph
  const lines = analysis.split('\n');
  let summaryFound = false;
  let summaryLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for summary section headers
    if (line.toLowerCase().includes('what this case is about') || 
        line.toLowerCase().includes('summary') ||
        line.toLowerCase().includes('this case') ||
        (line.startsWith('**') && line.toLowerCase().includes('about'))) {
      summaryFound = true;
      continue;
    }
    
    // If we found the summary section, collect sentences until next section
    if (summaryFound) {
      if (line.startsWith('**') || line.startsWith('##') || line.startsWith('#')) {
        // Hit next section, stop collecting
        break;
      }
      if (line.length > 20) {
        summaryLines.push(line);
      }
      // Stop after collecting 3-4 good sentences
      if (summaryLines.length >= 4) break;
    }
  }
  
  // If we found summary lines, use them
  if (summaryLines.length > 0) {
    const summary = summaryLines.join(' ').trim();
    // Clean up markdown formatting
    return summary
      .replace(/\*\*/g, '')
      .replace(/#{1,6}\s*/g, '')
      .substring(0, 500) // Limit length
      + (summary.length > 500 ? '...' : '');
  }
  
  // Fallback: Extract first 2-3 sentences from analysis
  const sentences = analysis.split(/[.!?]+/).filter(s => s.trim().length > 20 && !s.includes('**') && !s.startsWith('#'));
  
  if (sentences.length >= 3) {
    return sentences.slice(0, 3).join('. ').trim() + '.';
  } else if (sentences.length > 0) {
    return sentences.join('. ').trim() + (analysis.endsWith('.') ? '' : '.');
  }
  
  // Final fallback: create a basic summary from document text
  const words = combinedText.split(/\s+/).slice(0, 50).join(' ');
  return `This case involves ${words}...`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const country = (formData.get('country') as string) || 'India';

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Process all files and extract text
    const extractedTexts: { fileName: string; text: string }[] = [];

    for (const file of files) {
      try {
        const text = await processFile(file);
        extractedTexts.push({
          fileName: file.name,
          text: text || 'No text could be extracted from this file.',
        });
      } catch (error: any) {
        extractedTexts.push({
          fileName: file.name,
          text: `Error processing file: ${error.message}`,
        });
      }
    }

    // Combine all extracted text
    const combinedText = extractedTexts
      .map((item) => `File: ${item.fileName}\n${item.text}\n\n`)
      .join('---\n\n');

    // Analyze using Ollama
    const systemPrompt = `You are NYAAYBOT, an AI assistant specialized in legal document analysis. Your goal is to explain legal documents in simple, easy-to-understand language that anyone can follow.

IMPORTANT INSTRUCTIONS FOR WRITING:
1. Use plain, everyday language - avoid complex legal jargon
2. When you must mention a law or section, explain what it means in simple terms
3. Write as if explaining to a friend who has no legal background
4. Use short sentences and clear paragraphs
5. Break down complex concepts into simple explanations
6. Use examples and analogies when helpful
7. Avoid excessive use of technical terms - if you use them, define them immediately

Analyze the following legal document(s) and provide a clear, easy-to-understand analysis with these sections:

1. **What This Case Is About** - A simple summary in plain language explaining what happened, who is involved, and what the main issue is.

2. **Key Legal Points** - Explain the important legal aspects in simple terms. When mentioning laws or constitutional articles, explain what they mean in everyday language. For example, instead of just saying "Article 21", say "Article 21 (which protects the right to life) means that..."

3. **Important Laws and Rights** - List the relevant laws and rights, but explain each one in simple terms. Use a format like:
   - "Right to Life (Article 21) - This means everyone has the right to be safe and alive, and the government must protect this right"
   - "Murder Law (Section 302) - This law says that intentionally killing someone is a serious crime punishable by life in prison or death"

4. **Things to Consider** - Explain potential legal issues or complications in simple language, avoiding technical jargon.

5. **What Should Happen Next** - Provide clear, actionable recommendations in plain language.

WRITING STYLE:
- Write conversationally, like you're explaining to a friend
- Use "you" and "we" to make it more personal
- Avoid long, complex sentences
- Use bullet points and lists to break up information
- Explain legal terms immediately when you use them
- Focus on what the law means for real people, not just legal theory

Be thorough, accurate, and focus on legal aspects relevant to ${country} law and the Constitution of ${country}, but always prioritize clarity and simplicity over technical precision.`;

    const analysisPrompt = `${systemPrompt}\n\nDocuments to analyze:\n\n${combinedText}\n\nPlease provide a clear, easy-to-understand analysis that a non-lawyer can easily follow:`;

    let analysis = '';
    try {
      const response = await ollama.chat({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Analyze the following documents based on the Constitution of ${country}:\n\n${combinedText}`,
          },
        ],
        stream: false,
      });

      analysis = response.message.content;
    } catch (error: any) {
      // If Ollama fails, provide basic analysis
      if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
        analysis = `Ollama connection error. Please ensure Ollama is running and the ${OLLAMA_MODEL} model is available.\n\nExtracted text from documents:\n\n${combinedText}`;
      } else {
        analysis = `Analysis error: ${error.message}\n\nExtracted text from documents:\n\n${combinedText}`;
      }
    }

    // Calculate stats
    const endTime = Date.now();
    const timeTaken = ((endTime - startTime) / 1000).toFixed(1);
    const severity = calculateSeverity(combinedText);
    const confidence = calculateConfidence(combinedText, analysis);
    const court = determineCourt(severity, country);
    const summary = generateSummary(analysis, combinedText);

    return NextResponse.json({
      analysis,
      stats: {
        severity,
        confidence: Math.round(confidence),
        timeTaken: parseFloat(timeTaken),
        summary,
        court,
      },
      files: extractedTexts.map((item) => ({
        fileName: item.fileName,
        textLength: item.text.length,
        preview: item.text.substring(0, 200) + (item.text.length > 200 ? '...' : ''),
      })),
      totalFiles: files.length,
    });
  } catch (error: any) {
    console.error('Error in analyze API:', error);
    return NextResponse.json(
      { error: 'Failed to analyze documents', details: error.message },
      { status: 500 }
    );
  }
}

