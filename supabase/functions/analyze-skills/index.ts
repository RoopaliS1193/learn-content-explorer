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

interface SkillData {
  canonical: string;
  mappedTerms: string[];
  type: string;
}

// Simple fuzzy matching implementation for Deno environment
function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function calculateSimilarity(str1: string, str2: string): number {
  const distance = calculateLevenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : 1 - (distance / maxLength);
}

// Common misspelling patterns and corrections
const commonMisspellings: { [key: string]: string[] } = {
  'javascript': ['java script', 'java-script', 'js'],
  'python': ['phyton', 'pyhton'],
  'management': ['managment', 'mangement'],
  'communication': ['comunication', 'comunnication'],
  'leadership': ['leadershp', 'leadershipi'],
  'analysis': ['analisis', 'analisys'],
  'development': ['developement', 'devlopment'],
  'kubernetes': ['kubernets', 'kubernates', 'k8s'],
  'postgresql': ['postgres', 'postgre sql'],
  'machine learning': ['ml', 'machinelearning', 'machine-learning'],
  'artificial intelligence': ['ai', 'artificialintelligence'],
  'cloud computing': ['cloudcomputing', 'cloud-computing']
};

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
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        const pdfText = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(uint8Array);
        
        const textPattern = /(?:BT\s+.*?ET)|(?:\([^)]*\))|(?:<[^>]*>)/g;
        const matches = pdfText.match(textPattern) || [];
        
        let extractedText = matches
          .join(' ')
          .replace(/[()<>]/g, ' ')
          .replace(/BT|ET/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
          
        if (extractedText.length < 100) {
          extractedText = pdfText
            .replace(/[^\w\s\-.,;:!?]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
        
        return extractedText.substring(0, 100000);
      } catch (error) {
        console.error('PDF parsing error:', error);
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
        const arrayBuffer = await file.arrayBuffer();
        const text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(arrayBuffer);
        return text.replace(/[^\w\s\-.,;:!?]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 50000);
      }
    }
    
    const text = await file.text();
    return text.substring(0, 100000);
    
  } catch (error) {
    console.error('File extraction error:', error);
    throw new Error(`Failed to extract text from file: ${error.message}`);
  }
}

// Load comprehensive skills taxonomy from Supabase with proper mapped terms handling
async function loadSkillsTaxonomy(): Promise<{ taxonomy: SkillTaxonomy; skillsData: SkillData[] }> {
  console.log('Loading comprehensive skills taxonomy from Supabase...');
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: dbSkills, error } = await supabase
      .from('Skill library')
      .select('*');
    
    if (error) {
      console.error('Error loading skills from Supabase:', error);
      throw error;
    }
    
    const skillsData: SkillData[] = [];
    const allSkills: string[] = [];
    
    if (dbSkills && dbSkills.length > 0) {
      console.log(`Successfully loaded ${dbSkills.length} skill records from Supabase`);
      
      dbSkills.forEach(row => {
        const canonicalTerm = row['Canonical Term'];
        const mappedTerms = row['Mapped Terms'] || [];
        const skillType = row['Skill Type'] || 'Technical Skill';
        
        if (canonicalTerm) {
          skillsData.push({
            canonical: canonicalTerm,
            mappedTerms: Array.isArray(mappedTerms) ? mappedTerms : [],
            type: skillType
          });
          
          allSkills.push(canonicalTerm);
          
          if (Array.isArray(mappedTerms)) {
            mappedTerms.forEach((term: string) => {
              if (term && term.trim()) {
                allSkills.push(term.trim());
              }
            });
          }
        }
      });
      
      console.log(`Total skills loaded from Supabase: ${allSkills.length} (including ${skillsData.length} canonical terms and their mapped terms)`);
    } else {
      console.log('No skills found in Supabase, using fallback taxonomy');
    }
    
    // Enhanced base taxonomy for fallback
    const baseTaxonomy = {
      technical_skills: [
        "JavaScript", "Python", "Java", "C++", "C#", "React", "Node.js", "SQL", "MongoDB", "PostgreSQL", "MySQL",
        "HTML", "CSS", "TypeScript", "Angular", "Vue.js", "PHP", "Ruby", "Go", "Rust", "Swift", "Kotlin",
        "Kubernetes", "Docker", "AWS", "Azure", "Google Cloud", "Linux", "Git", "Jenkins", "Terraform",
        "Machine Learning", "Data Science", "Artificial Intelligence", "Deep Learning", "TensorFlow", "PyTorch",
        "API Development", "REST", "GraphQL", "Microservices", "DevOps", "CI/CD", "Testing", "Automation"
      ],
      functional_skills: [
        "Project Management", "Team Leadership", "Strategic Planning", "Business Analysis", "Product Management",
        "Requirements Gathering", "Stakeholder Management", "Change Management", "Risk Assessment", "Risk Management",
        "Process Improvement", "Quality Control", "Quality Assurance", "Customer Service", "Sales", "Marketing",
        "Human Resources", "Training Development", "Performance Management", "Recruitment", "Financial Planning"
      ],
      soft_skills: [
        "Communication", "Leadership", "Teamwork", "Problem Solving", "Critical Thinking", "Adaptability",
        "Creativity", "Time Management", "Organization", "Attention to Detail", "Decision Making", "Conflict Resolution",
        "Emotional Intelligence", "Interpersonal Skills", "Presentation Skills", "Public Speaking", "Writing"
      ]
    };
    
    // Combine Supabase skills with base taxonomy
    const combinedSkills = [...new Set([...allSkills, ...Object.values(baseTaxonomy).flat()])];
    
    // Categorize skills intelligently
    const enhancedTaxonomy = categorizeSkills(combinedSkills, skillsData);
    
    console.log(`Final taxonomy - Technical: ${enhancedTaxonomy.technical_skills.length}, Functional: ${enhancedTaxonomy.functional_skills.length}, Soft: ${enhancedTaxonomy.soft_skills.length}`);
    
    return { taxonomy: enhancedTaxonomy, skillsData };
    
  } catch (error) {
    console.error('Error loading skills taxonomy:', error);
    return {
      taxonomy: {
        technical_skills: ["JavaScript", "Python", "Java", "React", "SQL", "AWS", "Docker", "Git"],
        functional_skills: ["Project Management", "Business Analysis", "Marketing", "Sales"],
        soft_skills: ["Communication", "Leadership", "Problem Solving", "Teamwork"]
      },
      skillsData: []
    };
  }
}

// Intelligent skill categorization with Supabase type mapping
function categorizeSkills(skills: string[], skillsData: SkillData[] = []): SkillTaxonomy {
  const technical: string[] = [];
  const functional: string[] = [];
  const soft: string[] = [];
  
  // Create a map of skills to their Supabase types (case-insensitive)
  const skillTypeMap = new Map();
  skillsData.forEach(({ canonical, mappedTerms, type }) => {
    skillTypeMap.set(canonical.toLowerCase(), type);
    mappedTerms.forEach(term => {
      if (term && term.trim()) {
        skillTypeMap.set(term.toLowerCase().trim(), type);
      }
    });
  });
  
  const technicalKeywords = [
    'programming', 'development', 'software', 'hardware', 'system', 'network', 'database', 'security',
    'automation', 'testing', 'api', 'cloud', 'devops', 'machine learning', 'ai', 'data', 'analytics',
    'web', 'mobile', 'javascript', 'python', 'java', 'sql', 'html', 'css', 'framework', 'library',
    'server', 'infrastructure', 'deployment', 'monitoring', 'logging', 'backup', 'recovery',
    'instrumentation', 'calibration', 'plc', 'scada', 'control', 'measurement', 'electrical'
  ];
  
  const functionalKeywords = [
    'management', 'planning', 'strategy', 'business', 'operations', 'finance', 'accounting', 'sales',
    'marketing', 'hr', 'recruitment', 'training', 'quality', 'compliance', 'audit', 'legal',
    'procurement', 'supply chain', 'logistics', 'research', 'development', 'product', 'project'
  ];
  
  const softKeywords = [
    'communication', 'leadership', 'teamwork', 'collaboration', 'problem solving', 'thinking',
    'creativity', 'innovation', 'adaptability', 'flexibility', 'emotional', 'interpersonal',
    'social', 'presentation', 'speaking', 'listening', 'empathy', 'negotiation', 'conflict',
    'time management', 'organization', 'decision making', 'learning', 'cultural', 'diversity'
  ];
  
  skills.forEach(skill => {
    const skillLower = skill.toLowerCase();
    const supabaseType = skillTypeMap.get(skillLower);
    
    // First check if we have explicit type from Supabase
    if (supabaseType) {
      switch (supabaseType) {
        case 'Technical Skill':
          technical.push(skill);
          return;
        case 'Functional Skill':
          functional.push(skill);
          return;
        case 'Leadership Skill':
        case 'Soft Skill':
          soft.push(skill);
          return;
      }
    }
    
    // Fallback to keyword-based categorization
    if (technicalKeywords.some(keyword => skillLower.includes(keyword))) {
      technical.push(skill);
    } else if (functionalKeywords.some(keyword => skillLower.includes(keyword))) {
      functional.push(skill);
    } else if (softKeywords.some(keyword => skillLower.includes(keyword))) {
      soft.push(skill);
    } else {
      // Default categorization based on common patterns
      if (skillLower.length < 15 && /^[a-z]+(\s[a-z]+)*$/i.test(skill)) {
        soft.push(skill); // Short, simple skills often soft skills
      } else {
        technical.push(skill); // Default to technical for complex/compound terms
      }
    }
  });
  
  return {
    technical_skills: [...new Set(technical)],
    functional_skills: [...new Set(functional)],
    soft_skills: [...new Set(soft)]
  };
}

// Enhanced fuzzy skill extraction with complete word matching and misspelling handling
function extractSkillsWithContext(text: string, taxonomy: SkillTaxonomy, skillsData: SkillData[]): SkillMatch[] {
  const skills: SkillMatch[] = [];
  const lowerText = text.toLowerCase();
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Create a comprehensive skill map with all variations and fuzzy matching
  const skillMap = new Map<string, { canonical: string; category: string; type: string; variations: string[] }>();
  
  // Process each skill category
  const categories = [
    { name: 'technical', skills: taxonomy.technical_skills },
    { name: 'functional', skills: taxonomy.functional_skills },
    { name: 'soft', skills: taxonomy.soft_skills }
  ];
  
  // Build skill map with canonical, mapped terms, and misspelling variations
  categories.forEach(category => {
    category.skills.forEach(skill => {
      const skillLower = skill.toLowerCase();
      
      // Find corresponding skill data
      const skillData = skillsData.find(sd => 
        sd.canonical.toLowerCase() === skillLower ||
        sd.mappedTerms.some(mt => mt.toLowerCase() === skillLower)
      );
      
      // Collect all variations for this skill
      const variations = [skill];
      
      // Add mapped terms if available
      if (skillData) {
        skillData.mappedTerms.forEach(mappedTerm => {
          if (mappedTerm && mappedTerm.trim()) {
            variations.push(mappedTerm.trim());
          }
        });
      }
      
      // Add common misspellings
      const misspellings = commonMisspellings[skillLower] || [];
      variations.push(...misspellings);
      
      skillMap.set(skillLower, {
        canonical: skillData?.canonical || skill,
        category: category.name,
        type: skillData?.type || 'Unknown',
        variations: variations
      });
    });
  });
  
  console.log(`Built skill map with ${skillMap.size} total skills and their variations`);
  
  // Extract skills with optimized matching and complete word boundaries
  const foundSkills = new Map<string, SkillMatch>();
  const words = lowerText.split(/\s+/);
  
  // Pre-process words for faster matching
  const cleanWords = words.map(word => word.replace(/[^\w]/g, '')).filter(word => word.length >= 2);
  
  skillMap.forEach((skillInfo, skillKey) => {
    const contexts: string[] = [];
    let totalFrequency = 0;
    let totalConfidence = 0;
    
    // Check each variation of the skill
    skillInfo.variations.forEach(variation => {
      const variationLower = variation.toLowerCase();
      
      // Skip very short variations to avoid false positives
      if (variationLower.length < 2) return;
      
      // Create regex for complete word matching (case-insensitive)
      const escapedVariation = variationLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedVariation}\\b`, 'gi');
      
      // Count exact matches
      const exactMatches = lowerText.match(regex);
      if (exactMatches) {
        totalFrequency += exactMatches.length;
        totalConfidence += exactMatches.length * 30; // Higher confidence for exact matches
        
        // Extract contexts for exact matches (limit to first 2 to save memory)
        let contextCount = 0;
        for (const sentence of sentences) {
          if (contextCount >= 2) break;
          const sentenceLower = sentence.toLowerCase();
          if (regex.test(sentenceLower)) {
            contexts.push(sentence.trim().substring(0, 200));
            contextCount++;
            regex.lastIndex = 0;
          }
        }
      }
      
      // Optimized fuzzy matching for potential misspellings (only for longer skills)
      if (variationLower.length >= 4) {
        cleanWords.forEach(cleanWord => {
          if (cleanWord.length >= 3 && cleanWord !== variationLower && Math.abs(cleanWord.length - variationLower.length) <= 3) {
            const similarity = calculateSimilarity(cleanWord, variationLower);
            
            // If similarity is high (85%+), consider it a fuzzy match
            if (similarity >= 0.85 && similarity < 1.0) {
              totalFrequency += 1;
              totalConfidence += similarity * 15; // Lower confidence for fuzzy matches
              
              // Find context for fuzzy match (simplified)
              if (contexts.length < 2) {
                const wordIndex = lowerText.indexOf(cleanWord);
                if (wordIndex !== -1) {
                  const contextStart = Math.max(0, wordIndex - 30);
                  const contextEnd = Math.min(text.length, wordIndex + 70);
                  contexts.push(text.substring(contextStart, contextEnd).trim());
                }
              }
            }
          }
        });
      }
    });
    
    if (totalFrequency > 0) {
      // Calculate final confidence (cap at 100%)
      const finalConfidence = Math.min(totalConfidence, 100);
      
      // Only include skills with confidence >= 40%
      if (finalConfidence >= 40) {
        const canonicalName = skillInfo.canonical;
        const uniqueContexts = [...new Set(contexts)].slice(0, 2); // Limit contexts
        
        if (foundSkills.has(canonicalName)) {
          // Merge with existing entry
          const existing = foundSkills.get(canonicalName)!;
          existing.frequency += totalFrequency;
          existing.confidence = Math.min(existing.confidence + finalConfidence, 100);
          existing.contexts = [...new Set([...existing.contexts, ...uniqueContexts])].slice(0, 2);
        } else {
          // Create new entry
          foundSkills.set(canonicalName, {
            skill: canonicalName,
            frequency: totalFrequency,
            contexts: uniqueContexts,
            category: skillInfo.category,
            confidence: finalConfidence
          });
        }
      }
    }
  });
  
  const result = Array.from(foundSkills.values())
    .sort((a, b) => (b.frequency * b.confidence) - (a.frequency * a.confidence))
    .slice(0, 30); // Reduced from 50 to improve performance
  
  console.log(`Found ${result.length} skills with ≥40% confidence (optimized fuzzy matching)`);
  console.log('Top 5 skills:', result.slice(0, 5).map(s => `${s.skill} (${s.confidence.toFixed(1)}%)`));
  
  return result;
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
  const topSkills = skills.slice(0, 5).map(s => s.name);
  const categories = [...new Set(skills.map(s => s.category))];
  
  return `Analysis identified ${skills.length} relevant skills with >10% confidence across ${categories.length} categories. ` +
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

    // Load skills taxonomy and data
    const { taxonomy, skillsData } = await loadSkillsTaxonomy();
    console.log(`Loaded taxonomy with ${Object.values(taxonomy).flat().length} total skills`);
    console.log(`Loaded ${skillsData.length} skill data records from Supabase`);

    // Extract skills with enhanced fuzzy matching
    const matchedSkills = extractSkillsWithContext(extractedText, taxonomy, skillsData);
    console.log(`Found ${matchedSkills.length} high-confidence skill matches (≥40% confidence) with fuzzy matching`);

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

    console.log('Analysis completed successfully with fuzzy matching and 40% confidence threshold');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
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
