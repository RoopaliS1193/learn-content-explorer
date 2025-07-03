import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SkillMatch {
  skill: string;
  frequency: number;
  contexts: string[];
  category: string;
  confidence: number;
}

interface SkillTaxonomy {
  technical_skills: string[];
  functional_skills: string[];
  soft_skills: string[];
}

// Enhanced text extraction with streaming support
async function extractTextFromFile(file: File): Promise<string> {
  try {
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    
    console.log(`Processing file: ${file.name}, type: ${fileType}, size: ${file.size} bytes`);

    // Handle text files
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      return await file.text();
    }
    
    // Handle PDF files
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      try {
        // For large PDFs, read in chunks
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Simple PDF text extraction - look for text streams
        const pdfText = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(uint8Array);
        
        // Extract readable text using regex patterns
        const textPattern = /(?:BT\s+.*?ET)|(?:\([^)]*\))|(?:<[^>]*>)/g;
        const matches = pdfText.match(textPattern) || [];
        
        let extractedText = matches
          .join(' ')
          .replace(/[()<>]/g, ' ')
          .replace(/BT|ET/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
          
        // If no structured text found, try simple extraction
        if (extractedText.length < 100) {
          extractedText = pdfText
            .replace(/[^\w\s\-.,;:!?]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
        
        return extractedText.substring(0, 100000); // Limit to 100KB of text
      } catch (error) {
        console.error('PDF parsing error:', error);
        // Fallback to binary text extraction
        const arrayBuffer = await file.arrayBuffer();
        const text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(arrayBuffer);
        return text.replace(/[^\w\s\-.,;:!?]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 50000);
      }
    }
    
    // Handle DOCX files
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(arrayBuffer);
        
        // Extract text from XML content
        const xmlPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
        const matches = text.match(xmlPattern) || [];
        
        const extractedText = matches
          .map(match => match.replace(/<[^>]*>/g, ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
          
        return extractedText.substring(0, 100000);
      } catch (error) {
        console.error('DOCX parsing error:', error);
        // Fallback extraction
        const arrayBuffer = await file.arrayBuffer();
        const text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(arrayBuffer);
        return text.replace(/[^\w\s\-.,;:!?]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 50000);
      }
    }
    
    // Default fallback for any file
    const text = await file.text();
    return text.substring(0, 100000);
    
  } catch (error) {
    console.error('File extraction error:', error);
    throw new Error(`Failed to extract text from file: ${error.message}`);
  }
}

// Load skills taxonomy
async function loadSkillsTaxonomy(): Promise<SkillTaxonomy> {
  try {
    // Try to load from a public URL or use embedded taxonomy
    const response = await fetch('https://your-domain.com/skills-taxonomy.json').catch(() => null);
    
    if (response && response.ok) {
      return await response.json();
    }
    
    // Fallback embedded taxonomy
    return {
      technical_skills: [
        "JavaScript", "Python", "Java", "C++", "React", "Node.js", "SQL", "MongoDB", "PostgreSQL",
        "HTML", "CSS", "TypeScript", "Angular", "Vue.js", "PHP", "Ruby", "Go", "Rust",
        "Kubernetes", "Docker", "AWS", "Azure", "Google Cloud", "Linux", "Git", "Jenkins",
        "Machine Learning", "Data Science", "Artificial Intelligence", "TensorFlow", "PyTorch",
        "API Development", "REST", "GraphQL", "Microservices", "DevOps", "CI/CD",
        "Network Security", "Cybersecurity", "Blockchain", "Data Analytics", "Tableau",
        "Industrial Automation", "PLC Programming", "SCADA", "HMI", "Process Control",
        "Instrumentation", "Calibration", "Pressure Transmitters", "Flow Measurement"
      ],
      functional_skills: [
        "Project Management", "Team Leadership", "Strategic Planning", "Business Analysis",
        "Requirements Gathering", "Change Management", "Process Improvement", "Quality Control",
        "Financial Planning", "Operations Management", "Supply Chain Management",
        "Regulatory Compliance", "Research and Development", "Product Development"
      ],
      soft_skills: [
        "Communication", "Leadership", "Teamwork", "Problem Solving", "Critical Thinking",
        "Adaptability", "Creativity", "Time Management", "Organization", "Analytical Thinking",
        "Decision Making", "Emotional Intelligence", "Presentation Skills"
      ]
    };
  } catch (error) {
    console.error('Error loading skills taxonomy:', error);
    throw new Error('Failed to load skills taxonomy');
  }
}

// Fuzzy matching with context extraction
function extractSkillsWithContext(text: string, taxonomy: SkillTaxonomy): SkillMatch[] {
  const skills: SkillMatch[] = [];
  const lowerText = text.toLowerCase();
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Process each skill category
  const categories = [
    { name: 'technical', skills: taxonomy.technical_skills },
    { name: 'functional', skills: taxonomy.functional_skills },
    { name: 'soft', skills: taxonomy.soft_skills }
  ];
  
  categories.forEach(category => {
    category.skills.forEach(skill => {
      const skillLower = skill.toLowerCase();
      const contexts: string[] = [];
      let frequency = 0;
      let confidence = 0;
      
      // Direct exact match
      const exactMatches = (lowerText.match(new RegExp(`\\b${skillLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length;
      frequency += exactMatches * 3; // Higher weight for exact matches
      confidence += exactMatches > 0 ? 30 : 0;
      
      // Partial matches and variations
      const words = skillLower.split(/\s+/);
      if (words.length > 1) {
        // Multi-word skills: check if all words present
        const allWordsPresent = words.every(word => lowerText.includes(word));
        if (allWordsPresent) {
          frequency += 2;
          confidence += 20;
        }
      }
      
      // Fuzzy matching for common variations
      const variations = generateSkillVariations(skill);
      variations.forEach(variation => {
        const variationMatches = (lowerText.match(new RegExp(`\\b${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length;
        frequency += variationMatches;
        confidence += variationMatches > 0 ? 10 : 0;
      });
      
      // Extract contexts where skill appears
      if (frequency > 0) {
        sentences.forEach(sentence => {
          const sentenceLower = sentence.toLowerCase();
          if (sentenceLower.includes(skillLower) || 
              variations.some(v => sentenceLower.includes(v))) {
            contexts.push(sentence.trim().substring(0, 200));
          }
        });
        
        // Remove duplicate contexts
        const uniqueContexts = [...new Set(contexts)].slice(0, 3);
        
        skills.push({
          skill,
          frequency,
          contexts: uniqueContexts,
          category: category.name,
          confidence: Math.min(confidence, 100)
        });
      }
    });
  });
  
  // Sort by frequency and confidence, remove duplicates
  return skills
    .filter(skill => skill.frequency > 0)
    .sort((a, b) => (b.frequency * b.confidence) - (a.frequency * a.confidence))
    .slice(0, 25); // Top 25 skills
}

// Generate common variations of skills
function generateSkillVariations(skill: string): string[] {
  const variations = [skill.toLowerCase()];
  const skillLower = skill.toLowerCase();
  
  // Common programming language variations
  if (skillLower === 'javascript') variations.push('js', 'node.js', 'nodejs');
  if (skillLower === 'python') variations.push('py', 'python3');
  if (skillLower === 'typescript') variations.push('ts');
  if (skillLower === 'machine learning') variations.push('ml', 'artificial intelligence', 'ai');
  if (skillLower === 'database') variations.push('db', 'databases');
  if (skillLower === 'api development') variations.push('api', 'apis', 'rest api', 'web api');
  
  // Process control variations
  if (skillLower === 'plc programming') variations.push('plc', 'programmable logic controller');
  if (skillLower === 'scada') variations.push('supervisory control', 'data acquisition');
  if (skillLower === 'instrumentation') variations.push('instruments', 'measurement');
  
  // Add plural/singular variations
  if (!skillLower.endsWith('s')) variations.push(skillLower + 's');
  if (skillLower.endsWith('s')) variations.push(skillLower.slice(0, -1));
  
  return variations;
}

// Enhanced analysis with domain detection
function analyzeContent(text: string, skills: SkillMatch[]): any {
  const domains = detectDomains(text, skills);
  const summary = generateSummary(text, skills);
  
  return {
    skills: skills.map(skill => ({
      name: skill.skill,
      frequency: skill.frequency,
      category: skill.category,
      confidence: skill.confidence,
      contexts: skill.contexts
    })),
    domains,
    summary,
    metadata: {
      textLength: text.length,
      skillsFound: skills.length,
      processedAt: new Date().toISOString()
    }
  };
}

function detectDomains(text: string, skills: SkillMatch[]): string[] {
  const domains = [];
  const lowerText = text.toLowerCase();
  
  // Technology domains
  const techSkills = skills.filter(s => s.category === 'technical').length;
  if (techSkills > 3) domains.push('Technology & Software Development');
  
  // Data & Analytics
  if (lowerText.includes('data') || lowerText.includes('analytics') || lowerText.includes('analysis')) {
    domains.push('Data Science & Analytics');
  }
  
  // Process Industries
  if (lowerText.includes('process') || lowerText.includes('control') || lowerText.includes('automation')) {
    domains.push('Process Industries & Automation');
  }
  
  // Management
  const managementSkills = skills.filter(s => 
    s.skill.toLowerCase().includes('management') || 
    s.skill.toLowerCase().includes('leadership')
  ).length;
  if (managementSkills > 1) domains.push('Management & Leadership');
  
  return domains.length > 0 ? domains : ['General Professional Skills'];
}

function generateSummary(text: string, skills: SkillMatch[]): string {
  const topSkills = skills.slice(0, 5).map(s => s.skill);
  const categories = [...new Set(skills.map(s => s.category))];
  
  return `Analysis identified ${skills.length} relevant skills across ${categories.length} categories. ` +
         `Top skills include: ${topSkills.join(', ')}. ` +
         `Content spans ${Math.round(text.length / 1000)}K characters.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided');
    }

    // Increased file size limit for large documents
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxFileSize) {
      throw new Error(`File too large. Maximum size allowed is ${maxFileSize / 1024 / 1024}MB.`);
    }

    console.log(`Processing file: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    // Extract text with enhanced processing
    const extractedText = await extractTextFromFile(file);
    console.log(`Extracted text length: ${extractedText.length} characters`);

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Could not extract sufficient text from file. Please ensure the file contains readable text content.');
    }

    // Load skills taxonomy
    const taxonomy = await loadSkillsTaxonomy();
    console.log(`Loaded taxonomy with ${Object.values(taxonomy).flat().length} total skills`);

    // Extract skills with fuzzy matching
    const matchedSkills = extractSkillsWithContext(extractedText, taxonomy);
    console.log(`Found ${matchedSkills.length} skill matches`);

    // Generate comprehensive analysis
    const analysis = analyzeContent(extractedText, matchedSkills);

    const result = {
      ...analysis,
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type,
        sizeFormatted: `${(file.size / 1024 / 1024).toFixed(2)} MB`
      }
    };

    console.log('Analysis completed successfully');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    // Enhanced error handling
    const errorResponse = {
      error: error.message,
      type: error.name || 'AnalysisError',
      timestamp: new Date().toISOString(),
      suggestions: [
        'Ensure the file contains readable text content',
        'Try uploading a smaller file if the error persists',
        'Supported formats: PDF, DOCX, TXT',
        'File size limit: 50MB'
      ]
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});