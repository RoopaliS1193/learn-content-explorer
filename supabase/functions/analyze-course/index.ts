
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simplified text extraction to avoid memory issues
async function extractTextFromFile(file: File): Promise<string> {
  try {
    // Limit file size drastically for memory safety
    const maxSize = 50 * 1024; // 50KB only
    const buffer = await file.arrayBuffer();
    const limitedBuffer = buffer.slice(0, Math.min(buffer.byteLength, maxSize));
    
    if (file.type === 'text/plain') {
      const decoder = new TextDecoder();
      return decoder.decode(limitedBuffer);
    }
    
    // For binary files, just decode as text and extract readable parts
    const uint8Array = new Uint8Array(limitedBuffer);
    const text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(uint8Array);
    
    // Extract only simple readable text patterns
    const readable = text
      .replace(/[^\w\s\-.,;:!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return readable.substring(0, 1000); // Very limited text
  } catch (error) {
    console.error('File parsing error:', error);
    return '';
  }
}


// Helper function to analyze text and extract skills/keywords
function analyzeTextContent(text: string): { keywords: string[], skills: string[] } {
  const words = text.toLowerCase()
    .replace(/[^\w\s\-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  // Count word frequencies
  const wordFreq: { [key: string]: number } = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  // Technical skill patterns
  const skillPatterns = [
    /pressure.*transmitter/gi,
    /transmitter.*config/gi,
    /process.*calibration/gi,
    /diagnostics.*testing/gi,
    /wiring.*installation/gi,
    /explosion.*proof/gi,
    /intrinsic.*safety/gi,
    /loop.*testing/gi,
    /troubleshooting/gi,
    /maintenance/gi,
    /safety.*system/gi,
    /instrumentation/gi,
    /configuration/gi,
    /calibration/gi,
    /measurement/gi,
    /control.*system/gi,
    /electrical.*safety/gi,
    /process.*control/gi,
    /field.*device/gi,
    /communication.*protocol/gi,
    /hart.*protocol/gi,
    /foundation.*fieldbus/gi,
    /profibus/gi,
    /modbus/gi,
    /plc.*programming/gi,
    /scada/gi,
    /hmi/gi,
    /pid.*control/gi,
    /flow.*measurement/gi,
    /temperature.*measurement/gi,
    /level.*measurement/gi,
    /valve.*control/gi,
    /actuator/gi,
    /sensor.*technology/gi,
    /data.*acquisition/gi,
    /process.*optimization/gi,
    /quality.*control/gi,
    /regulatory.*compliance/gi
  ];
  
  // Extract skills based on patterns and frequency
  const extractedSkills = new Set<string>();
  
  skillPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        extractedSkills.add(match.replace(/\s+/g, ' ').trim());
      });
    }
  });
  
  // Add high-frequency technical terms as skills
  const technicalTerms = [
    'pressure', 'transmitter', 'calibration', 'configuration', 'diagnostics',
    'installation', 'maintenance', 'troubleshooting', 'safety', 'testing',
    'measurement', 'control', 'instrumentation', 'electrical', 'wiring',
    'communication', 'protocol', 'fieldbus', 'programming', 'optimization'
  ];
  
  technicalTerms.forEach(term => {
    if (wordFreq[term] && wordFreq[term] >= 3) {
      extractedSkills.add(term.charAt(0).toUpperCase() + term.slice(1));
    }
  });
  
  // Extract keywords (most frequent meaningful words)
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'among', 'this', 'that', 'these',
    'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
    'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'can', 'shall', 'his', 'her', 'its', 'their',
    'our', 'your', 'you', 'we', 'they', 'he', 'she', 'it', 'him', 'them',
    'us', 'me', 'my', 'mine', 'yours', 'his', 'hers', 'ours', 'theirs'
  ]);
  
  const meaningfulWords = Object.entries(wordFreq)
    .filter(([word, freq]) => !stopWords.has(word) && freq >= 2 && word.length > 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  
  return {
    keywords: meaningfulWords,
    skills: Array.from(extractedSkills).slice(0, 12)
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
    const { keywords, skills } = analyzeTextContent(extractedText);

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
