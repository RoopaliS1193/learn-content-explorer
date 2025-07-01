
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Comprehensive skill taxonomy combining O*NET, Lightcast, and common industry skills
const UNIVERSAL_SKILLS = {
  technical: [
    'Python Programming', 'JavaScript Programming', 'Java Programming', 'C++ Programming', 'SQL Database Management',
    'Machine Learning', 'Deep Learning', 'Artificial Intelligence', 'Data Science', 'Data Analysis',
    'Web Development', 'Frontend Development', 'Backend Development', 'Full Stack Development',
    'Cloud Computing', 'AWS', 'Azure', 'Google Cloud Platform', 'DevOps', 'Docker', 'Kubernetes',
    'Cybersecurity', 'Information Security', 'Network Security', 'Penetration Testing',
    'Software Engineering', 'System Design', 'API Development', 'Database Design',
    'Mobile App Development', 'iOS Development', 'Android Development', 'React Native',
    'Version Control', 'Git', 'Agile Development', 'Scrum Methodology',
    'Statistical Analysis', 'Data Visualization', 'Tableau', 'Power BI', 'Excel Advanced',
    'Project Management', 'Software Testing', 'Quality Assurance', 'User Experience Design',
    'User Interface Design', 'Graphic Design', 'Digital Marketing', 'SEO Optimization'
  ],
  business: [
    'Strategic Planning', 'Business Analysis', 'Financial Analysis', 'Market Research',
    'Customer Relationship Management', 'Sales Management', 'Marketing Strategy',
    'Digital Marketing', 'Content Marketing', 'Social Media Marketing', 'Email Marketing',
    'Supply Chain Management', 'Operations Management', 'Process Improvement',
    'Change Management', 'Risk Management', 'Compliance Management',
    'Budget Management', 'Financial Planning', 'Investment Analysis',
    'Human Resources Management', 'Talent Acquisition', 'Performance Management',
    'Negotiation', 'Vendor Management', 'Contract Management',
    'Business Development', 'Partnership Development', 'Client Relations'
  ],
  analytical: [
    'Critical Thinking', 'Problem Solving', 'Analytical Reasoning', 'Logical Thinking',
    'Research Methods', 'Quantitative Analysis', 'Qualitative Analysis',
    'Statistical Analysis', 'Data Interpretation', 'Pattern Recognition',
    'Root Cause Analysis', 'Decision Making', 'Strategic Thinking',
    'Systems Thinking', 'Process Analysis', 'Performance Analysis',
    'Trend Analysis', 'Forecasting', 'Predictive Modeling',
    'Hypothesis Testing', 'Experimental Design', 'Survey Design'
  ],
  communication: [
    'Written Communication', 'Verbal Communication', 'Public Speaking', 'Presentation Skills',
    'Technical Writing', 'Business Writing', 'Content Creation', 'Copywriting',
    'Cross-Cultural Communication', 'Interpersonal Communication', 'Active Listening',
    'Conflict Resolution', 'Negotiation', 'Persuasion', 'Storytelling',
    'Documentation', 'Report Writing', 'Proposal Writing', 'Grant Writing',
    'Translation', 'Language Proficiency', 'Multilingual Communication'
  ],
  leadership: [
    'Team Leadership', 'Project Leadership', 'Change Leadership', 'Organizational Leadership',
    'Strategic Leadership', 'Transformational Leadership', 'Servant Leadership',
    'Team Building', 'Team Management', 'People Management', 'Performance Coaching',
    'Mentoring', 'Training and Development', 'Succession Planning',
    'Decision Making', 'Delegation', 'Empowerment', 'Motivation',
    'Vision Setting', 'Goal Setting', 'Planning and Organization'
  ],
  creative: [
    'Creative Thinking', 'Innovation', 'Design Thinking', 'Brainstorming',
    'Visual Design', 'Graphic Design', 'Web Design', 'User Experience Design',
    'Creative Writing', 'Content Creation', 'Video Production', 'Photography',
    'Art Direction', 'Brand Development', 'Creative Strategy',
    'Problem Solving', 'Ideation', 'Conceptual Thinking'
  ],
  industry_specific: [
    'Healthcare Management', 'Patient Care', 'Medical Terminology', 'Clinical Research',
    'Education Technology', 'Curriculum Development', 'Instructional Design', 'Learning Management',
    'Financial Services', 'Banking', 'Insurance', 'Investment Management', 'Risk Assessment',
    'Manufacturing', 'Quality Control', 'Lean Manufacturing', 'Six Sigma',
    'Retail Management', 'Customer Service', 'Inventory Management', 'Merchandising',
    'Legal Research', 'Contract Law', 'Regulatory Compliance', 'Legal Writing',
    'Real Estate', 'Property Management', 'Market Analysis', 'Property Valuation'
  ]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      throw new Error('No file provided')
    }

    console.log('Processing file:', file.name, 'Size:', file.size)

    // Extract text content from file
    const text = await file.text()
    console.log('Extracted text length:', text.length)
    
    // Query custom skill taxonomy from Skill library table
    const { data: customSkills, error: skillsError } = await supabaseClient
      .from('Skill library')
      .select('*')
    
    if (skillsError) {
      console.error('Error fetching skills from Skill library:', skillsError)
    }

    console.log('Found custom skills in taxonomy:', customSkills?.length || 0)

    // Process text for better matching
    const lowerText = text.toLowerCase()
    const words = lowerText.match(/\b\w+\b/g) || []
    
    const matchedSkills: Array<{skill: string, source: string}> = []
    const extractedKeywords: string[] = []
    const extractedDomains: string[] = []

    // Match against custom skill taxonomy first
    customSkills?.forEach(skill => {
      const skillName = skill.Skill.toLowerCase()
      
      if (lowerText.includes(skillName) || words.some(word => 
        word.length > 3 && skillName.includes(word)
      )) {
        console.log('Matched custom skill:', skill.Skill)
        matchedSkills.push({skill: skill.Skill, source: 'Custom Taxonomy'})
        
        if (!extractedKeywords.includes(skill.Skill)) {
          extractedKeywords.push(skill.Skill)
        }
      }
    })

    // Match against universal skills taxonomy
    Object.entries(UNIVERSAL_SKILLS).forEach(([category, skills]) => {
      skills.forEach(skill => {
        const skillLower = skill.toLowerCase()
        const skillWords = skillLower.split(' ')
        
        // Check for exact matches or strong partial matches
        const hasExactMatch = lowerText.includes(skillLower)
        const hasStrongMatch = skillWords.length >= 2 && 
          skillWords.every(word => word.length > 2 && lowerText.includes(word))
        const hasPartialMatch = skillWords.some(word => 
          word.length > 4 && lowerText.includes(word)
        )
        
        if (hasExactMatch || hasStrongMatch || hasPartialMatch) {
          // Avoid duplicates
          const alreadyMatched = matchedSkills.some(matched => 
            matched.skill.toLowerCase() === skillLower
          )
          
          if (!alreadyMatched) {
            console.log('Matched universal skill:', skill, 'from category:', category)
            matchedSkills.push({skill: skill, source: 'Universal Taxonomy'})
            
            if (!extractedKeywords.includes(skill)) {
              extractedKeywords.push(skill)
            }
          }
        }
      })
    })

    // Enhanced domain categorization based on matched skills
    const skillTexts = matchedSkills.map(s => s.skill.toLowerCase())
    
    // Technology domains
    if (skillTexts.some(s => 
      s.includes('programming') || s.includes('development') || s.includes('software') || 
      s.includes('coding') || s.includes('javascript') || s.includes('python') ||
      s.includes('web') || s.includes('mobile') || s.includes('cloud') || s.includes('database')
    )) {
      extractedDomains.push('Technology & Software Development')
    }

    // Data & Analytics
    if (skillTexts.some(s => 
      s.includes('data') || s.includes('analysis') || s.includes('analytics') ||
      s.includes('machine learning') || s.includes('statistics') || s.includes('research')
    )) {
      extractedDomains.push('Data Science & Analytics')
    }

    // Business & Management
    if (skillTexts.some(s => 
      s.includes('management') || s.includes('business') || s.includes('leadership') ||
      s.includes('strategic') || s.includes('marketing') || s.includes('sales')
    )) {
      extractedDomains.push('Business & Management')
    }

    // Design & Creative
    if (skillTexts.some(s => 
      s.includes('design') || s.includes('creative') || s.includes('visual') ||
      s.includes('art') || s.includes('graphic') || s.includes('user experience')
    )) {
      extractedDomains.push('Design & Creative')
    }

    // Communication & Writing
    if (skillTexts.some(s => 
      s.includes('communication') || s.includes('writing') || s.includes('presentation') ||
      s.includes('speaking') || s.includes('content')
    )) {
      extractedDomains.push('Communication & Writing')
    }

    // Fallback if no matches found
    if (matchedSkills.length === 0) {
      console.log('No skill matches found, using basic analysis')
      
      // Basic keyword extraction from common educational terms
      const commonTerms = ['analysis', 'research', 'writing', 'communication', 'problem solving', 'critical thinking']
      commonTerms.forEach(term => {
        if (lowerText.includes(term)) {
          extractedKeywords.push(term.charAt(0).toUpperCase() + term.slice(1))
        }
      })
      
      extractedDomains.push('General Education')
      matchedSkills.push(
        {skill: 'Critical Thinking', source: 'Universal Taxonomy'},
        {skill: 'Communication', source: 'Universal Taxonomy'},
        {skill: 'Problem Solving', source: 'Universal Taxonomy'}
      )
    }

    // Sort matched skills by source (custom first, then universal)
    matchedSkills.sort((a, b) => {
      if (a.source === 'Custom Taxonomy' && b.source !== 'Custom Taxonomy') return -1
      if (b.source === 'Custom Taxonomy' && a.source !== 'Custom Taxonomy') return 1
      return a.skill.localeCompare(b.skill)
    })

    const result = {
      keywords: extractedKeywords.length > 0 ? extractedKeywords : ['learning', 'education', 'knowledge'],
      domains: extractedDomains.length > 0 ? extractedDomains : ['Education'],
      skills: matchedSkills.length > 0 ? matchedSkills.map(s => s.skill) : ['General Learning Skills'],
      skillSources: matchedSkills.length > 0 ? matchedSkills : [
        {skill: 'General Learning Skills', source: 'Universal Taxonomy'}
      ],
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type
      }
    }

    console.log('Final result:', result)
    console.log('Skills breakdown:', {
      custom: matchedSkills.filter(s => s.source === 'Custom Taxonomy').length,
      universal: matchedSkills.filter(s => s.source === 'Universal Taxonomy').length
    })

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      },
    )
  } catch (error) {
    console.error('Error in analyze-course function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 400 
      },
    )
  }
})
