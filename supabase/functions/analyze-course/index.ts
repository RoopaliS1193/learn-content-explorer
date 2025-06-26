
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    
    // Query skill taxonomy from your Skill library table
    const { data: skills, error: skillsError } = await supabaseClient
      .from('Skill library')
      .select('*')
    
    if (skillsError) {
      console.error('Error fetching skills from Skill library:', skillsError)
      throw skillsError
    }

    console.log('Found skills in taxonomy:', skills?.length || 0)

    // Process text for better matching
    const lowerText = text.toLowerCase()
    const words = lowerText.match(/\b\w+\b/g) || []
    
    const matchedSkills: string[] = []
    const extractedKeywords: string[] = []
    const extractedDomains: string[] = []

    // Match against your skill taxonomy
    skills?.forEach(skill => {
      const skillName = skill.Skill.toLowerCase()
      
      // Check for exact skill name match or partial matches
      if (lowerText.includes(skillName) || words.some(word => 
        word.length > 3 && skillName.includes(word)
      )) {
        console.log('Matched skill:', skill.Skill)
        matchedSkills.push(skill.Skill)
        
        // Add skill name as keyword
        if (!extractedKeywords.includes(skill.Skill)) {
          extractedKeywords.push(skill.Skill)
        }
      }
    })

    // If we have matched skills, extract related keywords
    if (matchedSkills.length > 0) {
      // Use the skills themselves as primary keywords
      matchedSkills.forEach(skill => {
        if (!extractedKeywords.includes(skill)) {
          extractedKeywords.push(skill)
        }
      })
      
      // Add some domain categorization based on matched skills
      const techSkills = matchedSkills.filter(skill => 
        skill.toLowerCase().includes('programming') || 
        skill.toLowerCase().includes('development') ||
        skill.toLowerCase().includes('software') ||
        skill.toLowerCase().includes('coding')
      )
      
      const analyticalSkills = matchedSkills.filter(skill =>
        skill.toLowerCase().includes('analysis') ||
        skill.toLowerCase().includes('data') ||
        skill.toLowerCase().includes('research')
      )
      
      const managementSkills = matchedSkills.filter(skill =>
        skill.toLowerCase().includes('management') ||
        skill.toLowerCase().includes('leadership') ||
        skill.toLowerCase().includes('project')
      )

      if (techSkills.length > 0) extractedDomains.push('Technology')
      if (analyticalSkills.length > 0) extractedDomains.push('Data & Analytics')
      if (managementSkills.length > 0) extractedDomains.push('Management')
    }

    // Fallback if no matches found
    if (matchedSkills.length === 0) {
      console.log('No skill matches found, using basic text analysis')
      
      // Basic keyword extraction from common educational terms
      const commonTerms = ['analysis', 'research', 'writing', 'communication', 'problem solving', 'critical thinking']
      commonTerms.forEach(term => {
        if (lowerText.includes(term)) {
          extractedKeywords.push(term.charAt(0).toUpperCase() + term.slice(1))
        }
      })
      
      // Default domains
      extractedDomains.push('General Education')
      
      // Use some keywords as skills if no specific skills were matched
      if (extractedKeywords.length > 0) {
        matchedSkills.push(...extractedKeywords.slice(0, 3))
      } else {
        matchedSkills.push('Critical Thinking', 'Communication', 'Problem Solving')
      }
    }

    const result = {
      keywords: extractedKeywords.length > 0 ? extractedKeywords : ['learning', 'education', 'knowledge'],
      domains: extractedDomains.length > 0 ? extractedDomains : ['Education'],
      skills: matchedSkills.length > 0 ? matchedSkills : ['General Learning Skills'],
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type
      }
    }

    console.log('Final result:', result)

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
