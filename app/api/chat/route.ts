import { NextRequest, NextResponse } from 'next/server';
import { Ollama } from 'ollama';
import axios from 'axios';
import * as cheerio from 'cheerio';
// @ts-ignore - bad-words doesn't have perfect TypeScript support
import Filter from 'bad-words';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
});

// Model configuration - can be overridden via environment variable
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud';
// Alternative model for reference: 'gpt-oss:20b'

// Initialize profanity filter
const filter = new Filter();
filter.addWords(...[]); // Add custom words if needed

// Valid sources for constitutions - government and legal databases
const VALID_SOURCES = [
  // Indian sources
  'indiankanoon.org',
  'lawcommissionofindia.nic.in',
  'legislative.gov.in',
  'lawmin.gov.in',
  'supremecourtofindia.nic.in',
  'judis.nic.in',
  'constitutionofindia.net',
  'mea.gov.in',
  // International legal databases and government sources
  'constituteproject.org',
  'constitutionnet.org',
  'worldconstitutions.org',
  'constitution.org',
  'loc.gov', // Library of Congress
  'congress.gov',
  'usconstitution.net',
  'gov.uk', // UK government
  'legislation.gov.uk',
  'canada.ca', // Canadian government
  'justice.gc.ca',
  'aph.gov.au', // Australian government
  'legislation.gov.au',
  'gov.za', // South African government
  'justice.gov.za',
  'gov.ie', // Irish government
  'oireachtas.ie',
  'govt.nz', // New Zealand government
  'legislation.govt.nz',
  'europa.eu', // European Union
  'eur-lex.europa.eu',
  'un.org', // United Nations
  'ohchr.org', // UN Human Rights
  'wipo.int', // World Intellectual Property Organization
  // Country-specific government domains (will be used dynamically)
  '.gov',
  '.gov.uk',
  '.gov.au',
  '.gov.ca',
  '.gov.za',
  '.gov.ie',
  '.govt.nz',
  '.gov.in',
  '.nic.in',
];

// Constitution-related keywords to filter content (international)
const CONSTITUTION_KEYWORDS = [
  'constitution',
  'constitutional',
  'article',
  'amendment',
  'preamble',
  'parliament',
  'congress',
  'legislature',
  'legislative',
  'judiciary',
  'judicial',
  'executive',
  'citizen',
  'citizenship',
  'state',
  'union',
  'federation',
  'president',
  'prime minister',
  'governor',
  'supreme court',
  'high court',
  'constitutional court',
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
  'human right',
  'fundamental right',
  'duty',
  'freedom',
  'liberty',
  'equality',
  'justice',
  'democracy',
  'democratic',
  'republic',
  'sovereign',
  'sovereignty',
  'separation of powers',
  'checks and balances',
  'bill of rights',
  'charter',
  'declaration',
  'treaty',
  'ratification',
];

// Country name mapping for better search
const COUNTRY_NAMES: { [key: string]: string } = {
  'usa': 'United States',
  'us': 'United States',
  'america': 'United States',
  'uk': 'United Kingdom',
  'britain': 'United Kingdom',
  'canada': 'Canada',
  'australia': 'Australia',
  'new zealand': 'New Zealand',
  'south africa': 'South Africa',
  'ireland': 'Ireland',
  'germany': 'Germany',
  'france': 'France',
  'italy': 'Italy',
  'spain': 'Spain',
  'japan': 'Japan',
  'china': 'China',
  'brazil': 'Brazil',
  'mexico': 'Mexico',
  'india': 'India',
  'pakistan': 'Pakistan',
  'bangladesh': 'Bangladesh',
  'sri lanka': 'Sri Lanka',
  'nepal': 'Nepal',
  'bangladesh': 'Bangladesh',
};

// Extract country name from query
function extractCountry(query: string): { country: string | null; queryWithoutCountry: string } {
  const lowerQuery = query.toLowerCase();
  
  for (const [key, country] of Object.entries(COUNTRY_NAMES)) {
    if (lowerQuery.includes(key)) {
      return {
        country,
        queryWithoutCountry: query.replace(new RegExp(key, 'gi'), '').trim(),
      };
    }
  }
  
  // Check for common country name patterns
  const countryPattern = /(?:constitution of|constitution in|constitution for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i;
  const match = query.match(countryPattern);
  if (match && match[1]) {
    return {
      country: match[1],
      queryWithoutCountry: query.replace(countryPattern, '').trim(),
    };
  }
  
  return { country: null, queryWithoutCountry: query };
}

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
    // Extract country from query
    const { country, queryWithoutCountry } = extractCountry(query);
    const countryName = country || 'India'; // Default to India if no country specified
    
    // Build constitution query
    let constitutionQuery = query;
    if (!isConstitutionRelated(query)) {
      constitutionQuery = `Constitution of ${countryName} ${queryWithoutCountry || query}`;
    } else if (country) {
      constitutionQuery = `Constitution of ${countryName} ${queryWithoutCountry}`;
    }
    
    let context = '';
    const maxContextLength = 5000; // Limit total context length
    
    // Prioritize sources based on country
    const sourcesToSearch = country 
      ? [
          // International databases first
          'constituteproject.org',
          'constitutionnet.org',
          'worldconstitutions.org',
          'constitution.org',
          'loc.gov',
          ...VALID_SOURCES.filter(s => !s.startsWith('.'))
        ]
      : VALID_SOURCES.filter(s => !s.startsWith('.')); // Filter out domain patterns
    
    for (const source of sourcesToSearch) {
      if (context.length >= maxContextLength) break;
      
      try {
        // Search specifically for Constitution content
        const sourceQuery = `site:${source} "${constitutionQuery}"`;
        
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
          error: 'Your message contains inappropriate content. Please ask questions only about constitutions and constitutional law.',
        },
        { status: 400 }
      );
    }

    const filteredMessage = validation.filtered || message;

    // Extract country from query
    const { country } = extractCountry(filteredMessage);
    const countryName = country || 'India'; // Default to India if no country specified

    // Search for Constitution-related information
    const webContext = await searchConstitutionInfo(filteredMessage);

    // Prepare system prompt for any country's constitution
    const systemPrompt = `You are NYAAYBOT, a friendly and approachable AI assistant specialized in providing information about constitutions from around the world. You're here to help users understand constitutional law in a warm, welcoming, and easy-to-understand way.

YOUR PERSONALITY:
- Be friendly, warm, and conversational
- Use a helpful and encouraging tone
- Show enthusiasm about helping users learn
- Be patient and understanding
- Use simple language when explaining complex legal concepts
- Feel free to use emojis occasionally to make responses more engaging (but don't overuse them)
- Be conversational, as if talking to a friend who's curious about law

STRICT RULES:
1. Answer questions about the Constitution of ${countryName} (or any country mentioned in the query), including articles, amendments, provisions, and related legal concepts
2. If asked about non-constitutional topics, politely and friendly redirect to constitution-related topics
3. NEVER use profanity, inappropriate language, or offensive content
4. Keep responses accurate, constitution-focused, but friendly and approachable
5. Use ONLY the provided web context from valid legal sources (government websites, legal databases, constitutional law resources)
6. If web context is not constitution-related, ignore it
7. When discussing any country's constitution, provide accurate, factual information from legitimate sources

You should provide accurate, helpful information about:
- Constitutional articles, sections, and provisions
- Constitutional amendments
- Fundamental rights, human rights, and civil liberties
- Constitutional structure and branches of government
- Constitutional history and development
- Legal concepts related to constitutional law
- Comparative constitutional analysis when relevant

Web search context (ONLY Constitution-related content from legitimate sources):
${webContext}

IMPORTANT: 
- Be friendly and approachable while maintaining accuracy
- Always cite sources when possible
- If information is not available, acknowledge this honestly and offer to help with related topics
- Use warm, conversational language while staying professional
- When comparing constitutions, be objective and factual but explain in a friendly way
- Respect the legal and cultural context of each country's constitution
- Make complex legal concepts accessible and easy to understand
- Show genuine interest in helping the user learn`;

    // Get response from Ollama using configured model
    const response = await ollama.chat({
      model: OLLAMA_MODEL,
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
      // If response is not Constitution-related, add a friendly redirect
      botMessage = "I'd love to help! I specialize in answering questions about constitutions from around the world. Feel free to ask me about constitutional articles, amendments, rights, or any related legal provisions. 😊\n\n" + botMessage;
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
          error: `Cannot connect to Ollama. Please ensure Ollama is running and the ${OLLAMA_MODEL} model is available.`,
          details: `Check available models with: ollama list. Supported models: gpt-oss:120b-cloud (default), gpt-oss:20b (alternative)`,
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

