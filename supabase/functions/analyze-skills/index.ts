
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

// Simple fuzzy matching implementation optimized for performance
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match gets 100%
  if (s1 === s2) return 1.0;
  
  // Skip fuzzy matching for very different lengths to save processing
  if (Math.abs(s1.length - s2.length) > Math.max(s1.length, s2.length) * 0.5) {
    return 0;
  }
  
  // Simple character overlap ratio for performance
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matches++;
    }
  }
  
  return matches / longer.length;
}

// Common misspelling patterns - reduced set for performance
const commonMisspellings: { [key: string]: string[] } = {
  'javascript': ['java script', 'js'],
  'python': ['phyton'],
  'management': ['managment'],
  'communication': ['comunication'],
  'leadership': ['leadershp'],
  'kubernetes': ['k8s'],
  'postgresql': ['postgres'],
  'machine learning': ['ml'],
  'artificial intelligence': ['ai']
};

// Enhanced text extraction with size limits
async function extractTextFromFile(file: File): Promise<string> {
  try {
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    
    console.log(`Processing file: ${file.name}, type: ${fileType}, size: ${file.size} bytes`);

    // Handle text files
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      const text = await file.text();
      return text.substring(0, 50000); // Limit text size
    }
    
    // Handle PDF files with basic extraction
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(uint8Array);
        
        // Simple text extraction
        const cleanText = text
          .replace(/[^\w\s\-.,;:!?]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
          
        return cleanText.substring(0, 50000);
      } catch (error) {
        console.error('PDF parsing error:', error);
        throw new Error('Failed to extract text from PDF file');
      }
    }
    
    // Handle other files as text
    const text = await file.text();
    return text.substring(0, 50000);
    
  } catch (error) {
    console.error('File extraction error:', error);
    throw new Error(`Failed to extract text from file: ${error.message}`);
  }
}

// Optimized skills loading with database-side filtering and pagination
async function loadRelevantSkills(extractedText: string): Promise<{ taxonomy: SkillTaxonomy; relevantSkills: any[] }> {
  console.log('Loading relevant skills from Supabase with text analysis...');
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Extract keywords from text for database filtering
    const words = extractedText.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 3)
      .slice(0, 200); // Limit keywords for performance
    
    const uniqueWords = [...new Set(words)];
    console.log(`Extracted ${uniqueWords.length} unique keywords for filtering`);
    
    // Create search pattern for database filtering
    const searchTerms = uniqueWords.slice(0, 50); // Limit search terms
    
    // Load skills in batches, filtering by relevance
    const batchSize = 1000;
    const relevantSkills: any[] = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore && relevantSkills.length < 5000) { // Cap total skills loaded
      console.log(`Loading skill batch ${offset / batchSize + 1}, offset: ${offset}`);
      
      const { data: batchSkills, error } = await supabase
        .from('Skill library')
        .select('*')
        .range(offset, offset + batchSize - 1)
        .order('Canonical Term');
      
      if (error) {
        console.error('Error loading skills batch:', error);
        throw error;
      }
      
      if (!batchSkills || batchSkills.length === 0) {
        hasMore = false;
        break;
      }
      
      // Filter skills that might be relevant to the text
      const filteredSkills = batchSkills.filter(skill => {
        const canonicalTerm = skill['Canonical Term']?.toLowerCase() || '';
        const mappedTerms = skill['Mapped Terms'] || [];
        
        // Check if any search term matches skill terms
        const allSkillTerms = [canonicalTerm, ...mappedTerms.map((t: string) => t.toLowerCase())];
        
        return searchTerms.some(searchTerm => 
          allSkillTerms.some(skillTerm => 
            skillTerm.includes(searchTerm) || searchTerm.includes(skillTerm)
          )
        );
      });
      
      relevantSkills.push(...filteredSkills);
      offset += batchSize;
      
      console.log(`Batch processed: ${filteredSkills.length} relevant skills found`);
    }
    
    console.log(`Total relevant skills loaded: ${relevantSkills.length}`);
    
    // Build taxonomy from relevant skills only
    const allSkillTerms: string[] = [];
    relevantSkills.forEach(skill => {
      const canonicalTerm = skill['Canonical Term'];
      if (canonicalTerm) {
        allSkillTerms.push(canonicalTerm);
        const mappedTerms = skill['Mapped Terms'] || [];
        mappedTerms.forEach((term: string) => {
          if (term && term.trim()) {
            allSkillTerms.push(term.trim());
          }
        });
      }
    });
    
    const taxonomy = categorizeSkills(allSkillTerms, relevantSkills);
    
    console.log(`Taxonomy built - Technical: ${taxonomy.technical_skills.length}, Functional: ${taxonomy.functional_skills.length}, Soft: ${taxonomy.soft_skills.length}`);
    
    return { taxonomy, relevantSkills };
    
  } catch (error) {
    console.error('Error loading skills:', error);
    // Fallback to basic taxonomy
    return {
      taxonomy: {
        technical_skills: ["JavaScript", "Python", "Java", "React", "SQL", "AWS"],
        functional_skills: ["Project Management", "Business Analysis"],
        soft_skills: ["Communication", "Leadership", "Problem Solving"]
      },
      relevantSkills: []
    };
  }
}

// Simplified skill categorization
function categorizeSkills(skills: string[], skillsData: any[] = []): SkillTaxonomy {
  const technical: string[] = [];
  const functional: string[] = [];
  const soft: string[] = [];
  
  // Create type mapping
  const skillTypeMap = new Map();
  skillsData.forEach(skill => {
    const canonical = skill['Canonical Term'];
    const type = skill['Skill Type'];
    const mappedTerms = skill['Mapped Terms'] || [];
    
    if (canonical && type) {
      skillTypeMap.set(canonical.toLowerCase(), type);
      mappedTerms.forEach((term: string) => {
        if (term && term.trim()) {
          skillTypeMap.set(term.toLowerCase().trim(), type);
        }
      });
    }
  });
  
  // Categorize skills
  skills.forEach(skill => {
    const skillLower = skill.toLowerCase();
    const supabaseType = skillTypeMap.get(skillLower);
    
    if (supabaseType) {
      switch (supabaseType) {
        case 'Technical Skill':
          technical.push(skill);
          break;
        case 'Functional Skill':
          functional.push(skill);
          break;
        case 'Leadership Skill':
        case 'Soft Skill':
          soft.push(skill);
          break;
        default:
          technical.push(skill);
      }
    } else {
      // Simple fallback categorization
      technical.push(skill);
    }
  });
  
  return {
    technical_skills: [...new Set(technical)],
    functional_skills: [...new Set(functional)],
    soft_skills: [...new Set(soft)]
  };
}

// Optimized skill extraction with complete word matching
function extractSkillsWithContext(text: string, taxonomy: SkillTaxonomy, skillsData: any[]): SkillMatch[] {
  console.log('Starting optimized skill extraction...');
  
  const skills: SkillMatch[] = [];
  const lowerText = text.toLowerCase();
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10).slice(0, 100); // Limit sentences
  
  // Create skill variations map (only for relevant skills)
  const skillVariations = new Map<string, { canonical: string; category: string; variations: string[] }>();
  
  const categories = [
    { name: 'technical', skills: taxonomy.technical_skills },
    { name: 'functional', skills: taxonomy.functional_skills },
    { name: 'soft', skills: taxonomy.soft_skills }
  ];
  
  categories.forEach(category => {
    category.skills.forEach(skill => {
      const skillLower = skill.toLowerCase();
      const skillData = skillsData.find(sd => 
        sd['Canonical Term']?.toLowerCase() === skillLower
      );
      
      const variations = [skill];
      if (skillData && skillData['Mapped Terms']) {
        skillData['Mapped Terms'].forEach((term: string) => {
          if (term && term.trim()) {
            variations.push(term.trim());
          }
        });
      }
      
      // Add common misspellings
      const misspellings = commonMisspellings[skillLower] || [];
      variations.push(...misspellings);
      
      skillVariations.set(skillLower, {
        canonical: skillData?.['Canonical Term'] || skill,
        category: category.name,
        variations: variations
      });
    });
  });
  
  console.log(`Processing ${skillVariations.size} skill variations`);
  
  // Extract skills with exact word matching
  const foundSkills = new Map<string, SkillMatch>();
  
  skillVariations.forEach((skillInfo, skillKey) => {
    let totalFrequency = 0;
    let totalConfidence = 0;
    const contexts: string[] = [];
    
    skillInfo.variations.forEach(variation => {
      const variationLower = variation.toLowerCase();
      if (variationLower.length < 2) return;
      
      // Create word boundary regex for exact matching
      const escapedVariation = variationLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedVariation}\\b`, 'gi');
      
      const matches = lowerText.match(regex);
      if (matches) {
        totalFrequency += matches.length;
        totalConfidence += matches.length * 35; // Base confidence
        
        // Get context (limit to 1 per variation)
        if (contexts.length < 1) {
          for (const sentence of sentences.slice(0, 20)) { // Limit sentence search
            if (regex.test(sentence.toLowerCase())) {
              contexts.push(sentence.trim().substring(0, 150));
              break;
            }
          }
        }
      }
    });
    
    if (totalFrequency > 0) {
      const finalConfidence = Math.min(totalConfidence, 100);
      
      if (finalConfidence >= 40) {
        const canonicalName = skillInfo.canonical;
        
        foundSkills.set(canonicalName, {
          skill: canonicalName,
          frequency: totalFrequency,
          contexts: contexts,
          category: skillInfo.category,
          confidence: finalConfidence
        });
      }
    }
  });
  
  const result = Array.from(foundSkills.values())
    .sort((a, b) => (b.frequency * b.confidence) - (a.frequency * a.confidence))
    .slice(0, 25); // Limit results
  
  console.log(`Found ${result.length} skills with ≥40% confidence`);
  
  return result;
}

// Simplified analysis
function analyzeContent(text: string, skills: SkillMatch[]): any {
  const domains = detectDomains(text, skills);
  const summary = generateSummary(text, skills);
  
  return {
    skills: skills.map(skill => ({
      name: skill.skill,
      frequency: skill.frequency,
      category: skill.category,
      confidence: skill.confidence,
      contexts: skill.contexts.slice(0, 1) // Limit contexts
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
  
  const techSkills = skills.filter(s => s.category === 'technical').length;
  if (techSkills > 2) domains.push('Technology & Software Development');
  
  if (lowerText.includes('data') || lowerText.includes('analytics')) {
    domains.push('Data Science & Analytics');
  }
  
  const managementSkills = skills.filter(s => 
    s.skill.toLowerCase().includes('management') || 
    s.skill.toLowerCase().includes('leadership')
  ).length;
  if (managementSkills > 0) domains.push('Management & Leadership');
  
  return domains.length > 0 ? domains : ['General Professional Skills'];
}

function generateSummary(text: string, skills: SkillMatch[]): string {
  const topSkills = skills.slice(0, 3).map(s => s.name);
  const categories = [...new Set(skills.map(s => s.category))];
  
  return `Analysis identified ${skills.length} relevant skills across ${categories.length} categories. ` +
         `Top skills: ${topSkills.join(', ')}.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting file analysis...');
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided');
    }

    const maxFileSize = 25 * 1024 * 1024; // Reduced to 25MB
    if (file.size > maxFileSize) {
      throw new Error(`File too large. Maximum size allowed is ${maxFileSize / 1024 / 1024}MB.`);
    }

    console.log(`Processing file: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    // Extract text
    const extractedText = await extractTextFromFile(file);
    console.log(`Extracted text length: ${extractedText.length} characters`);

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Could not extract sufficient text from file. Please ensure the file contains readable text content.');
    }

    // Load only relevant skills based on text content
    const { taxonomy, relevantSkills } = await loadRelevantSkills(extractedText);
    console.log(`Loaded ${relevantSkills.length} relevant skills for analysis`);

    // Extract skills with optimized matching
    const matchedSkills = extractSkillsWithContext(extractedText, taxonomy, relevantSkills);
    console.log(`Found ${matchedSkills.length} high-confidence skill matches`);

    // Generate analysis
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
    
    const errorResponse = {
      error: error.message || 'Unknown error occurred',
      type: error.name || 'AnalysisError',
      timestamp: new Date().toISOString(),
      stack: error.stack,
      suggestions: [
        'Ensure the file contains readable text content',
        'Try uploading a smaller file (max 25MB)',
        'Supported formats: PDF, DOCX, TXT'
      ]
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
