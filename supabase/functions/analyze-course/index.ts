
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Optimized universal skills taxonomy - focused on most common skills
const UNIVERSAL_SKILLS = {
  technical: [
    'Python', 'JavaScript', 'Java', 'SQL', 'Machine Learning', 'Data Analysis',
    'Web Development', 'Cloud Computing', 'AWS', 'Azure', 'Cybersecurity',
    'Software Engineering', 'API Development', 'Mobile Development', 'DevOps',
    'Git', 'Agile', 'Testing', 'Database Design', 'User Experience'
  ],
  business: [
    'Project Management', 'Strategic Planning', 'Business Analysis', 'Marketing',
    'Sales', 'Customer Service', 'Operations', 'Finance', 'Leadership',
    'Communication', 'Negotiation', 'Risk Management', 'Supply Chain'
  ],
  analytical: [
    'Critical Thinking', 'Problem Solving', 'Research', 'Data Interpretation',
    'Statistical Analysis', 'Decision Making', 'Process Improvement'
  ]
}

// Helper function to create skill variations for better matching
function generateSkillVariations(skill: string): string[] {
  const variations = [skill.toLowerCase()]
  
  // Add common variations
  const words = skill.toLowerCase().split(' ')
  if (words.length > 1) {
    variations.push(words.join(''))  // Remove spaces
    variations.push(words.join('-'))  // Hyphenated
  }
  
  return variations
}

// Optimized text preprocessing
function preprocessText(text: string): { cleanText: string, keywords: string[] } {
  // Limit text processing to first 50,000 characters to avoid timeouts
  const limitedText = text.substring(0, 50000).toLowerCase()
  
  // Extract meaningful keywords (longer than 2 chars, alphanumeric)
  const keywords = limitedText.match(/\b[a-z]{3,}\b/g) || []
  
  // Create a set for O(1) lookup
  const keywordSet = new Set(keywords)
  
  return {
    cleanText: limitedText,
    keywords: Array.from(keywordSet)
  }
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

    // Extract and preprocess text
    const text = await file.text()
    console.log('Extracted text length:', text.length)
    
    const { cleanText, keywords } = preprocessText(text)
    console.log('Preprocessed keywords count:', keywords.length)
    
    // Query custom skill taxonomy
    const { data: customSkills, error: skillsError } = await supabaseClient
      .from('Skill library')
      .select('*')
    
    if (skillsError) {
      console.error('Error fetching skills:', skillsError)
    }

    console.log('Found custom skills in taxonomy:', customSkills?.length || 0)

    const matchedSkills: Array<{skill: string, source: string}> = []
    const extractedKeywords: string[] = []
    const extractedDomains: string[] = []

    // Match against custom skill taxonomy with optimized search
    if (customSkills) {
      for (const skill of customSkills) {
        const skillVariations = generateSkillVariations(skill.Skill)
        
        const isMatch = skillVariations.some(variation => 
          keywords.includes(variation) || cleanText.includes(variation)
        )
        
        if (isMatch) {
          console.log('Matched custom skill:', skill.Skill)
          matchedSkills.push({skill: skill.Skill, source: 'Custom Taxonomy'})
          extractedKeywords.push(skill.Skill)
        }
      }
    }

    // Match against universal skills with optimized search
    for (const [category, skills] of Object.entries(UNIVERSAL_SKILLS)) {
      for (const skill of skills) {
        const skillVariations = generateSkillVariations(skill)
        
        const isMatch = skillVariations.some(variation => 
          keywords.includes(variation) || cleanText.includes(variation)
        )
        
        if (isMatch) {
          // Avoid duplicates
          const alreadyMatched = matchedSkills.some(matched => 
            matched.skill.toLowerCase() === skill.toLowerCase()
          )
          
          if (!alreadyMatched) {
            console.log('Matched universal skill:', skill, 'from category:', category)
            matchedSkills.push({skill: skill, source: 'Universal Taxonomy'})
            extractedKeywords.push(skill)
          }
        }
      }
    }

    // Enhanced domain classification
    const skillTexts = matchedSkills.map(s => s.skill.toLowerCase())
    
    if (skillTexts.some(s => 
      ['python', 'javascript', 'java', 'sql', 'programming', 'development', 'software', 'web', 'mobile', 'cloud', 'database'].some(tech => s.includes(tech))
    )) {
      extractedDomains.push('Technology & Software Development')
    }

    if (skillTexts.some(s => 
      ['data', 'analysis', 'analytics', 'machine learning', 'statistics', 'research'].some(data => s.includes(data))
    )) {
      extractedDomains.push('Data Science & Analytics')
    }

    if (skillTexts.some(s => 
      ['management', 'business', 'leadership', 'strategic', 'marketing', 'sales', 'project'].some(biz => s.includes(biz))
    )) {
      extractedDomains.push('Business & Management')
    }

    if (skillTexts.some(s => 
      ['communication', 'writing', 'presentation', 'speaking'].some(comm => s.includes(comm))
    )) {
      extractedDomains.push('Communication & Writing')
    }

    // Fallback for no matches
    if (matchedSkills.length === 0) {
      console.log('No skill matches found, using fallback analysis')
      
      // Basic keyword extraction for fallback
      const commonTerms = ['analysis', 'management', 'development', 'communication', 'research']
      commonTerms.forEach(term => {
        if (cleanText.includes(term)) {
          extractedKeywords.push(term.charAt(0).toUpperCase() + term.slice(1))
        }
      })
      
      extractedDomains.push('General Education')
      matchedSkills.push(
        {skill: 'Critical Thinking', source: 'Universal Taxonomy'},
        {skill: 'Problem Solving', source: 'Universal Taxonomy'}
      )
    }

    // Sort skills by source (custom first, then universal)
    matchedSkills.sort((a, b) => {
      if (a.source === 'Custom Taxonomy' && b.source !== 'Custom Taxonomy') return -1
      if (b.source === 'Custom Taxonomy' && a.source !== 'Custom Taxonomy') return 1
      return a.skill.localeCompare(b.skill)
    })

    const result = {
      keywords: extractedKeywords.length > 0 ? extractedKeywords.slice(0, 15) : ['learning', 'education'],
      domains: extractedDomains.length > 0 ? extractedDomains : ['Education'],
      skills: matchedSkills.map(s => s.skill),
      skillSources: matchedSkills,
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type
      }
    }

    console.log('Analysis complete. Skills found:', matchedSkills.length)
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
