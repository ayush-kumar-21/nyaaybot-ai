import { NextRequest, NextResponse } from 'next/server';
import { Ollama } from 'ollama';
import { createWorker } from 'tesseract.js';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import sharp from 'sharp';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
});

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

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
    const systemPrompt = `You are NYAAYBOT, an AI assistant specialized in legal document analysis. 
Analyze the following legal document(s) and provide:
1. A comprehensive summary
2. Key legal points and provisions
3. Important clauses and references
4. Potential legal issues or considerations
5. Recommendations or insights

Be thorough, accurate, and focus on legal aspects relevant to Indian law and the Constitution of India.`;

    const analysisPrompt = `${systemPrompt}\n\nDocuments to analyze:\n\n${combinedText}\n\nPlease provide a detailed analysis:`;

    let analysis = '';
    try {
      const response = await ollama.chat({
        model: 'gpt-oss:20b',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Analyze the following documents:\n\n${combinedText}`,
          },
        ],
        stream: false,
      });

      analysis = response.message.content;
    } catch (error: any) {
      // If Ollama fails, provide basic analysis
      if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
        analysis = `Ollama connection error. Please ensure Ollama is running and the gpt-oss:20b model is installed.\n\nExtracted text from documents:\n\n${combinedText}`;
      } else {
        analysis = `Analysis error: ${error.message}\n\nExtracted text from documents:\n\n${combinedText}`;
      }
    }

    return NextResponse.json({
      analysis,
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

