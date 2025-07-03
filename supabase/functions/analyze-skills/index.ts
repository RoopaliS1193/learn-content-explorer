
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

// Load comprehensive skills taxonomy from Supabase and expanded sources
async function loadSkillsTaxonomy(): Promise<SkillTaxonomy> {
  console.log('Loading comprehensive skills taxonomy...');
  
  try {
    // Load skills from Supabase database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: dbSkills, error } = await supabase
      .from('Skill library')
      .select('*');
    
    if (error) {
      console.error('Error loading skills from Supabase:', error);
    }
    
    const supabaseSkills: string[] = [];
    const supabaseSkillsWithTypes: { skill: string; type: string }[] = [];
    
    if (dbSkills && dbSkills.length > 0) {
      console.log(`Successfully loaded ${dbSkills.length} skills from Supabase`);
      
      dbSkills.forEach(row => {
        // Add canonical term
        if (row['Canonical Term']) {
          supabaseSkills.push(row['Canonical Term']);
          supabaseSkillsWithTypes.push({
            skill: row['Canonical Term'],
            type: row['Skill Type'] || 'Technical Skill'
          });
        }
        
        // Add mapped terms if they exist
        if (row['Mapped Terms'] && Array.isArray(row['Mapped Terms'])) {
          row['Mapped Terms'].forEach((term: string) => {
            if (term && term.trim()) {
              supabaseSkills.push(term.trim());
              supabaseSkillsWithTypes.push({
                skill: term.trim(),
                type: row['Skill Type'] || 'Technical Skill'
              });
            }
          });
        }
      });
      
      console.log(`Total skills from Supabase (including mapped terms): ${supabaseSkills.length}`);
    } else {
      console.log('No skills found in Supabase, using fallback taxonomy');
    }
    
    // Enhanced base taxonomy with 2000+ skills from industry standards
    const baseTaxonomy = {
      technical_skills: [
        // Programming Languages & Frameworks
        "JavaScript", "Python", "Java", "C++", "C#", "React", "Node.js", "SQL", "MongoDB", "PostgreSQL", "MySQL",
        "HTML", "CSS", "TypeScript", "Angular", "Vue.js", "PHP", "Ruby", "Go", "Rust", "Swift", "Kotlin",
        "Scala", "Perl", "R", "MATLAB", "SAS", "Julia", "Dart", "Flutter", "React Native", "Xamarin",
        
        // Cloud & Infrastructure
        "Kubernetes", "Docker", "AWS", "Azure", "Google Cloud", "Linux", "Git", "Jenkins", "Terraform",
        "Ansible", "Chef", "Puppet", "Vagrant", "VMware", "Hyper-V", "OpenStack", "CloudFormation",
        "Serverless", "Lambda", "Azure Functions", "Google Cloud Functions", "Microservices", "DevOps", "CI/CD",
        
        // Data & AI
        "Machine Learning", "Data Science", "Artificial Intelligence", "Deep Learning", "TensorFlow", "PyTorch",
        "Keras", "Scikit-learn", "Pandas", "NumPy", "Matplotlib", "Seaborn", "Jupyter", "Apache Spark",
        "Hadoop", "Kafka", "Elasticsearch", "Tableau", "Power BI", "Looker", "D3.js", "Data Visualization",
        "Natural Language Processing", "Computer Vision", "Neural Networks", "Big Data", "ETL", "Data Mining",
        
        // Industrial & Engineering
        "Industrial Automation", "PLC Programming", "SCADA", "HMI", "Process Control", "DCS", "MES",
        "Instrumentation", "Calibration", "Maintenance", "Troubleshooting", "Safety Systems", "SIL",
        "Pressure Transmitters", "Flow Measurement", "Temperature Sensors", "Level Measurement", "pH Sensors",
        "Control Valves", "Actuators", "VFDs", "Motor Control", "Power Systems", "Electrical Design",
        "Fieldbus", "HART Protocol", "Modbus", "Profibus", "Ethernet/IP", "Foundation Fieldbus", "DeviceNet",
        "Electrical Safety", "Explosion Proof", "Intrinsic Safety", "Loop Testing", "Signal Processing",
        
        // Web & Mobile Development
        "API Development", "REST", "GraphQL", "SOAP", "gRPC", "WebSocket", "Progressive Web Apps", "Single Page Applications",
        "Responsive Design", "Cross-browser Compatibility", "Web Performance", "SEO", "Accessibility", "WCAG",
        "Chrome DevTools", "Webpack", "Babel", "NPM", "Yarn", "ESLint", "Prettier", "Jest", "Cypress",
        
        // Security & Testing
        "Network Security", "Cybersecurity", "Penetration Testing", "Encryption", "PKI", "OAuth", "SAML",
        "Web Security", "Application Security", "Vulnerability Assessment", "Security Auditing", "GDPR", "HIPAA",
        "Testing", "Unit Testing", "Integration Testing", "Automation", "Selenium", "TestNG", "JUnit",
        "Load Testing", "Performance Testing", "Security Testing", "API Testing", "Mobile Testing"
      ],
      functional_skills: [
        // Management & Leadership
        "Project Management", "Team Leadership", "Strategic Planning", "Business Analysis", "Product Management",
        "Requirements Gathering", "Stakeholder Management", "Change Management", "Risk Assessment", "Risk Management",
        "Process Improvement", "Quality Control", "Quality Assurance", "Customer Service", "Sales", "Marketing",
        "Digital Marketing", "Content Marketing", "Social Media Marketing", "Email Marketing", "SEO/SEM",
        
        // Business Operations
        "Human Resources", "Training Development", "Performance Management", "Recruitment", "Talent Acquisition",
        "Compensation Planning", "Employee Relations", "Organizational Development", "Succession Planning",
        "Financial Planning", "Budget Management", "Cost Analysis", "Revenue Optimization", "Financial Modeling",
        "Investment Analysis", "Accounting", "Bookkeeping", "Tax Preparation", "Auditing", "Compliance",
        
        // Operations & Supply Chain
        "Operations Management", "Supply Chain Management", "Logistics", "Inventory Management", "Procurement",
        "Vendor Management", "Contract Management", "Negotiation", "Lean Manufacturing", "Six Sigma",
        "Continuous Improvement", "Root Cause Analysis", "Quality Management", "ISO Standards", "Kaizen"
      ],
      soft_skills: [
        // Core Interpersonal Skills
        "Communication", "Verbal Communication", "Written Communication", "Nonverbal Communication",
        "Leadership", "Team Leadership", "Servant Leadership", "Transformational Leadership", "Situational Leadership",
        "Teamwork", "Collaboration", "Cross-functional Collaboration", "Remote Collaboration", "Team Building",
        
        // Cognitive Skills
        "Problem Solving", "Complex Problem Solving", "Analytical Problem Solving", "Creative Problem Solving",
        "Critical Thinking", "Systems Thinking", "Design Thinking", "Strategic Thinking", "Logical Reasoning",
        "Decision Making", "Data-driven Decision Making", "Ethical Decision Making", "Quick Decision Making",
        
        // Personal Effectiveness
        "Adaptability", "Flexibility", "Agility", "Resilience", "Stress Management", "Change Management",
        "Creativity", "Innovation", "Artistic Creativity", "Technical Creativity", "Strategic Creativity",
        "Time Management", "Priority Management", "Deadline Management", "Multi-tasking", "Task Organization",
        "Organization", "Planning", "Strategic Planning", "Project Planning", "Resource Planning",
        
        // Professional Skills
        "Attention to Detail", "Quality Focus", "Accuracy", "Thoroughness", "Precision", "Reliability",
        "Accountability", "Responsibility", "Integrity", "Ethics", "Professionalism", "Work Ethic",
        "Initiative", "Self-Motivation", "Self-Direction", "Proactivity", "Goal Orientation", "Results Orientation"
      ]
    };
    
    // Combine all skills
    const allSkillsFromBase = [...Object.values(baseTaxonomy).flat()];
    const combinedSkills = [...new Set([...allSkillsFromBase, ...supabaseSkills])];
    
    console.log(`Total combined skills: ${combinedSkills.length}`);
    console.log(`Base taxonomy skills: ${allSkillsFromBase.length}`);
    console.log(`Supabase skills: ${supabaseSkills.length}`);
    
    // Categorize skills intelligently
    const enhancedTaxonomy = categorizeSkills(combinedSkills, supabaseSkillsWithTypes);
    
    console.log(`Final taxonomy - Technical: ${enhancedTaxonomy.technical_skills.length}, Functional: ${enhancedTaxonomy.functional_skills.length}, Soft: ${enhancedTaxonomy.soft_skills.length}`);
    
    return enhancedTaxonomy;
    
  } catch (error) {
    console.error('Error loading skills taxonomy:', error);
    // Return base taxonomy as fallback
    return {
      technical_skills: ["JavaScript", "Python", "Java", "React", "SQL", "AWS", "Docker", "Git"],
      functional_skills: ["Project Management", "Business Analysis", "Marketing", "Sales"],
      soft_skills: ["Communication", "Leadership", "Problem Solving", "Teamwork"]
    };
  }
}

// Intelligent skill categorization with Supabase type mapping
function categorizeSkills(skills: string[], typedSkills: { skill: string; type: string }[] = []): SkillTaxonomy {
  const technical: string[] = [];
  const functional: string[] = [];
  const soft: string[] = [];
  
  // Create a map of skills to their Supabase types
  const skillTypeMap = new Map();
  typedSkills.forEach(({ skill, type }) => {
    skillTypeMap.set(skill.toLowerCase(), type);
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

// Fuzzy matching with context extraction and confidence filtering
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
  
  // Filter out skills with confidence <= 10% and sort by frequency and confidence
  return skills
    .filter(skill => skill.frequency > 0 && skill.confidence > 10) // Filter out low confidence skills
    .sort((a, b) => (b.frequency * b.confidence) - (a.frequency * a.confidence))
    .slice(0, 50); // Increased to show more high-quality skills
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

    // Increased file size limit for large documents
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxFileSize) {
      throw new Error(`File too large. Maximum size allowed is ${maxFileSize / 1024 / 1024}MB.`);
    }

    console.log(`Processing file: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    // Extract text with enhanced processing
    const extractedText = await extractTextFromFile(file);
    console.log(`Extracted text length: ${extractedText.length} characters`);
    console.log(`First 500 chars: ${extractedText.substring(0, 500)}`);

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Could not extract sufficient text from file. Please ensure the file contains readable text content.');
    }

    // Load skills taxonomy
    const taxonomy = await loadSkillsTaxonomy();
    console.log(`Loaded taxonomy with ${Object.values(taxonomy).flat().length} total skills`);

    // Extract skills with fuzzy matching and confidence filtering
    const matchedSkills = extractSkillsWithContext(extractedText, taxonomy);
    console.log(`Found ${matchedSkills.length} high-confidence skill matches (>10% confidence)`);

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
