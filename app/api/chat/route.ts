import { NextRequest, NextResponse } from 'next/server';
import { Ollama } from 'ollama';
import axios from 'axios';
import * as cheerio from 'cheerio';
// @ts-ignore - bad-words doesn't have perfect TypeScript support
import Filter from 'bad-words';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
});

// Initialize profanity filter
const filter = new Filter();
filter.addWords(...[]); // Add custom words if needed

// Valid sources for Constitution of India
const VALID_SOURCES = [
  'indiankanoon.org',
  'lawcommissionofindia.nic.in',
  'legislative.gov.in',
  'lawmin.gov.in',
  'supremecourtofindia.nic.in',
  'judis.nic.in',
  'constitutionofindia.net',
  'mea.gov.in',
];

// Constitution-related keywords to filter content
const CONSTITUTION_KEYWORDS = [
  'constitution',
  'article',
  'fundamental right',
  'directive principle',
  'amendment',
  'preamble',
  'parliament',
  'legislature',
  'judiciary',
  'executive',
  'citizen',
  'citizenship',
  'state',
  'union',
  'president',
  'governor',
  'supreme court',
  'high court',
  'constitutional',
  'legal',
  'law',
  'act',
  'bill',
  'ordinance',
  'schedule',
  'part',
  'chapter',
  'section',
  'clause',
  'provision',
  'right',
  'duty',
  'freedom',
  'equality',
  'liberty',
  'justice',
  'fraternity',
  'secular',
  'democratic',
  'republic',
  'sovereign',
  'socialist',
];

// Check if text is Constitution-related
function isConstitutionRelated(text: string): boolean {
  const lowerText = text.toLowerCase();
  const keywordCount = CONSTITUTION_KEYWORDS.filter((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  ).length;
  
  // At least 2 Constitution keywords should be present
  return keywordCount >= 2;
}

// Filter profanity and inappropriate content
function filterContent(text: string): string {
  // Remove profanity
  let filtered = filter.clean(text);
  
  // Remove excessive special characters and noise
  filtered = filtered.replace(/[^\w\s.,;:!?()[\]{}'"-]/g, ' ');
  
  // Remove excessive whitespace
  filtered = filtered.replace(/\s+/g, ' ').trim();
  
  return filtered;
}

// Extract and clean text from HTML
function extractCleanText($: cheerio.CheerioAPI): string {
  // Remove script and style elements
  $('script, style, nav, footer, header, aside, .ad, .advertisement, .ads').remove();
  
  // Get main content
  const mainContent = $('main, article, .content, .main-content, #content, body').first();
  let text = mainContent.text() || $('body').text();
  
  // Clean the text
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// Search for Constitution-related information from valid sources
async function searchConstitutionInfo(query: string): Promise<string> {
  try {
    // Ensure query is Constitution-related
    const lowerQuery = query.toLowerCase();
    if (!isConstitutionRelated(query)) {
      // Add Constitution context to query
      query = `Constitution of India ${query}`;
    }
    
    let context = '';
    const maxContextLength = 5000; // Limit total context length
    
    for (const source of VALID_SOURCES) {
      if (context.length >= maxContextLength) break;
      
      try {
        // Search specifically for Constitution content
        const sourceQuery = `site:${source} "Constitution of India" ${query}`;
        
        const response = await axios.get(
          `https://www.google.com/search?q=${encodeURIComponent(sourceQuery)}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
            timeout: 8000,
          }
        );
        
        const $ = cheerio.load(response.data);
        const links = $('a[href*="' + source + '"]').slice(0, 2); // Limit to 2 links per source
        
        for (let i = 0; i < links.length; i++) {
          if (context.length >= maxContextLength) break;
          
          const link = $(links[i]).attr('href');
          if (link && link.startsWith('http')) {
            try {
              const pageResponse = await axios.get(link, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
                timeout: 8000,
                maxRedirects: 3,
              });
              
              const page$ = cheerio.load(pageResponse.data);
              let text = extractCleanText(page$);
              
              // Filter: Only include if Constitution-related
              if (!isConstitutionRelated(text)) {
                continue;
              }
              
              // Filter profanity and inappropriate content
              text = filterContent(text);
              
              // Limit text length per page
              text = text.substring(0, 1500);
              
              if (text.length > 100) { // Only add if substantial content
                context += `\nSource: ${source}\n${text}\n\n`;
              }
            } catch (err) {
              // Continue to next link
              continue;
            }
          }
        }
      } catch (err) {
        // Continue to next source
        continue;
      }
    }
    
    // Final filtering: Remove any remaining non-Constitution content
    if (context && !isConstitutionRelated(context)) {
      return 'No Constitution-related information found from valid sources.';
    }
    
    return context || 'No Constitution-related information found from valid sources.';
  } catch (error) {
    console.error('Error searching for Constitution info:', error);
    return 'Unable to fetch Constitution information from web sources.';
  }
}

// Validate user message
function validateUserMessage(message: string): { valid: boolean; filtered?: string } {
  // Check for profanity
  if (filter.isProfane(message)) {
    return { valid: false };
  }
  
  // Filter the message
  const filtered = filterContent(message);
  
  // Check if it's Constitution-related (at least somewhat)
  if (!isConstitutionRelated(message) && message.length > 20) {
    // Allow if it's a short question that might be Constitution-related
    return { valid: true, filtered };
  }
  
  return { valid: true, filtered };
}

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Validate and filter user message
    const validation = validateUserMessage(message);
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Your message contains inappropriate content. Please ask questions only about the Constitution of India.',
        },
        { status: 400 }
      );
    }

    const filteredMessage = validation.filtered || message;

    // Search for Constitution-related information ONLY
    const webContext = await searchConstitutionInfo(filteredMessage);

    // Prepare strict system prompt focused ONLY on Constitution
    const systemPrompt = `You are NYAAYBOT, an AI assistant EXCLUSIVELY specialized in providing information about the Constitution of India. 

STRICT RULES:
1. ONLY answer questions about the Constitution of India, its articles, amendments, provisions, and related legal concepts
2. If asked about anything else, politely redirect to Constitution-related topics
3. NEVER use profanity, inappropriate language, or offensive content
4. Keep responses professional, accurate, and Constitution-focused
5. Use ONLY the provided web context from valid legal sources
6. If web context is not Constitution-related, ignore it

You should provide accurate, helpful information about:
- Fundamental Rights (Articles 12-35)
- Directive Principles of State Policy (Articles 36-51)
- Fundamental Duties (Article 51A)
- Constitutional Amendments
- Constitutional Provisions and Articles
- Legal concepts related to the Indian Constitution
- Constitutional history and structure

Web search context (ONLY Constitution-related content):
${webContext}

IMPORTANT: 
- If the question is not about the Constitution of India, politely say: "I can only help with questions about the Constitution of India. Please ask about constitutional articles, amendments, fundamental rights, or related legal provisions."
- Always cite sources when possible
- Provide accurate information only
- Keep language professional and appropriate`;

    // Get response from Ollama using gpt-oss:20b model
    const response = await ollama.chat({
      model: 'gpt-oss:20b',
      messages: [
        ...conversationHistory,
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: filteredMessage,
        },
      ],
      stream: false,
    });

    let botMessage = response.message.content;

    // Final safety check: Filter profanity from bot response
    if (filter.isProfane(botMessage)) {
      botMessage = filter.clean(botMessage);
    }

    // Final check: Ensure response is Constitution-related
    if (!isConstitutionRelated(botMessage) && botMessage.length > 50) {
      // If response is not Constitution-related, add a redirect
      botMessage = "I can only help with questions about the Constitution of India. Please ask about constitutional articles, amendments, fundamental rights, or related legal provisions.\n\n" + botMessage;
    }

    return NextResponse.json({
      message: botMessage,
      sources: webContext && webContext.includes('Source:') ? 'Information retrieved from valid legal sources' : null,
    });
  } catch (error: unknown) {
    console.error('Error in chat API:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it's an Ollama connection error
    if (errorMessage.includes('ECONNREFUSED') || (error as { code?: string }).code === 'ECONNREFUSED') {
      return NextResponse.json(
        {
          error: 'Cannot connect to Ollama. Please ensure Ollama is running and the gpt-oss:20b model is installed.',
          details: 'Run: ollama pull gpt-oss:20b',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process chat message', details: errorMessage },
      { status: 500 }
    );
  }
}

