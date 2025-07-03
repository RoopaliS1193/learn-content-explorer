
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced text extraction for better file differentiation
async function extractTextFromFile(file: File): Promise<string> {
  try {
    console.log(`Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`);
    
    const buffer = await file.arrayBuffer();
    let extractedText = '';

    if (file.type === 'application/pdf') {
      try {
        // For PDF files, try to extract structured text
        const uint8Array = new Uint8Array(buffer);
        const text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(uint8Array);
        
        // Look for text patterns in PDF structure
        const textMatches = text.match(/\((.*?)\)/g) || [];
        const streamMatches = text.match(/stream\s*(.*?)\s*endstream/gs) || [];
        
        extractedText = [...textMatches, ...streamMatches]
          .join(' ')
          .replace(/[^\w\s\-.,;:!?()\[\]]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
          
      } catch (pdfError) {
        console.log('PDF parsing fallback:', pdfError);
        const text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(buffer);
        extractedText = text.replace(/[^\w\s\-.,;:!?]/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } else if (file.type.includes('word') || file.name.endsWith('.docx')) {
      try {
        // For DOCX files, look for document.xml content
        const text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(buffer);
        const xmlMatches = text.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
        
        extractedText = xmlMatches
          .map(match => match.replace(/<[^>]*>/g, ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
          
        if (!extractedText) {
          // Fallback to general text extraction
          extractedText = text.replace(/[^\w\s\-.,;:!?]/g, ' ').replace(/\s+/g, ' ').trim();
        }
      } catch (docxError) {
        console.log('DOCX parsing fallback:', docxError);
        const text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(buffer);
        extractedText = text.replace(/[^\w\s\-.,;:!?]/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } else if (file.type === 'text/plain') {
      const decoder = new TextDecoder();
      extractedText = decoder.decode(buffer);
    } else {
      // Generic text extraction for other formats
      const text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(buffer);
      extractedText = text.replace(/[^\w\s\-.,;:!?]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Create unique content hash for logging
    const fileHash = `${file.name}-${file.size}-${buffer.byteLength}`;
    console.log(`File hash: ${fileHash}`);
    console.log(`Extracted ${extractedText.length} characters`);
    console.log(`Sample content: ${extractedText.substring(0, 200)}...`);
    
    return extractedText;
  } catch (error) {
    console.error('File parsing error:', error);
    return '';
  }
}


// Dynamic text analysis for unique content extraction
function analyzeTextContent(text: string, fileInfo: { name: string, size: number }): { keywords: string[], skills: string[] } {
  console.log(`Analyzing text for file: ${fileInfo.name} (${fileInfo.size} bytes)`);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s\-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  console.log(`Found ${words.length} words in text`);
  
  // Count word frequencies
  const wordFreq: { [key: string]: number } = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  // Dynamic skill extraction based on actual content
  const extractedSkills = new Set<string>();
  
  // Look for technical terms that appear frequently (adaptive approach)
  const technicalIndicators = [
    'programming', 'development', 'software', 'hardware', 'system', 'network',
    'database', 'security', 'automation', 'analysis', 'management', 'design',
    'testing', 'implementation', 'configuration', 'maintenance', 'optimization',
    'integration', 'administration', 'monitoring', 'troubleshooting', 'documentation',
    'training', 'certification', 'compliance', 'quality', 'performance', 'research'
  ];
  
  // Extract skills based on context and frequency
  technicalIndicators.forEach(indicator => {
    if (wordFreq[indicator] && wordFreq[indicator] >= 2) {
      // Look for related terms around this indicator
      const regex = new RegExp(`\\b\\w+\\s+${indicator}|${indicator}\\s+\\w+\\b`, 'gi');
      const matches = text.match(regex) || [];
      
      matches.forEach(match => {
        const cleanMatch = match.replace(/\s+/g, ' ').trim();
        if (cleanMatch.length > 3 && cleanMatch.length < 50) {
          extractedSkills.add(cleanMatch.charAt(0).toUpperCase() + cleanMatch.slice(1));
        }
      });
      
      // Also add the base term if frequent enough
      if (wordFreq[indicator] >= 3) {
        extractedSkills.add(indicator.charAt(0).toUpperCase() + indicator.slice(1));
      }
    }
  });

  // Extract compound technical terms (two-word combinations)
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    const phraseFreq = text.toLowerCase().split(phrase).length - 1;
    
    if (phraseFreq >= 2 && words[i].length > 3 && words[i + 1].length > 3) {
      const techWords = ['data', 'software', 'system', 'network', 'security', 'web', 'cloud', 'mobile', 'api'];
      if (techWords.some(tech => phrase.includes(tech))) {
        extractedSkills.add(phrase.charAt(0).toUpperCase() + phrase.slice(1));
      }
    }
  }

  // Extract keywords (most frequent meaningful words unique to this content)
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'among', 'this', 'that', 'these',
    'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
    'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'can', 'shall', 'his', 'her', 'its', 'their',
    'our', 'your', 'you', 'we', 'they', 'he', 'she', 'it', 'him', 'them',
    'us', 'me', 'my', 'mine', 'yours', 'his', 'hers', 'ours', 'theirs',
    'also', 'more', 'most', 'some', 'any', 'all', 'each', 'every', 'both',
    'either', 'neither', 'other', 'another', 'such', 'same', 'different'
  ]);
  
  const meaningfulWords = Object.entries(wordFreq)
    .filter(([word, freq]) => !stopWords.has(word) && freq >= 2 && word.length > 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  
  console.log(`Extracted ${extractedSkills.size} skills and ${meaningfulWords.length} keywords`);
  
  return {
    keywords: meaningfulWords.length > 0 ? meaningfulWords : [`Analysis of ${fileInfo.name}`],
    skills: Array.from(extractedSkills).slice(0, 15)
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided');
    }

    // Check file size limit (1MB max for memory safety)
    const maxFileSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxFileSize) {
      throw new Error('File too large. Maximum size allowed is 1MB.');
    }

    console.log(`Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Extract text using simplified function
    const extractedText = await extractTextFromFile(file);

    console.log(`Extracted text length: ${extractedText.length}`);
    console.log(`First 200 chars: ${extractedText.substring(0, 200)}`);

    if (!extractedText || extractedText.length < 10) {
      throw new Error('Could not extract sufficient text from file');
    }

    // Analyze the extracted text
    const { keywords, skills } = analyzeTextContent(extractedText, { name: file.name, size: file.size });

    // Get skills from database
    const { data: dbSkills } = await supabase
      .from('Skill library')
      .select('Skill');

    const customSkills = dbSkills?.map(row => row.Skill) || [];

    // Combine and deduplicate skills
    const allSkills = [...skills, ...customSkills.slice(0, 5)];
    const uniqueSkills = [...new Set(allSkills)].slice(0, 15);

    // Generate domains based on extracted content
    const domains = [];
    const lowerText = extractedText.toLowerCase();
    
    if (lowerText.includes('pressure') || lowerText.includes('transmitter')) {
      domains.push('Process Instrumentation');
    }
    if (lowerText.includes('control') || lowerText.includes('automation')) {
      domains.push('Industrial Automation');
    }
    if (lowerText.includes('safety') || lowerText.includes('hazard')) {
      domains.push('Process Safety');
    }
    if (lowerText.includes('calibration') || lowerText.includes('measurement')) {
      domains.push('Measurement & Calibration');
    }
    if (lowerText.includes('maintenance') || lowerText.includes('troubleshoot')) {
      domains.push('Equipment Maintenance');
    }
    
    // Default domains if none detected
    if (domains.length === 0) {
      domains.push('Technical Training', 'Professional Development');
    }

    const result = {
      keywords: keywords.length > 0 ? keywords : ['Technical', 'Training', 'Course', 'Content'],
      domains: domains.slice(0, 5),
      skills: uniqueSkills.length > 0 ? uniqueSkills : ['Technical Skills', 'Problem Solving'],
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type
      }
    };

    console.log('Analysis result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Make sure the file contains readable text content'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
