
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

    // Extract text content from file (simplified for demo)
    const text = await file.text()
    
    // Query skill taxonomy from database
    const { data: skills, error: skillsError } = await supabaseClient
      .from('skill_taxonomy')
      .select('*')
    
    if (skillsError) {
      console.error('Error fetching skills:', skillsError)
      throw skillsError
    }

    // Simple keyword matching logic (you can enhance this)
    const extractedKeywords: string[] = []
    const extractedDomains: string[] = []
    const extractedSkills: string[] = []

    // Match against taxonomy
    skills?.forEach(skill => {
      if (text.toLowerCase().includes(skill.name.toLowerCase())) {
        extractedSkills.push(skill.name)
        if (skill.domain && !extractedDomains.includes(skill.domain)) {
          extractedDomains.push(skill.domain)
        }
        if (skill.keywords) {
          const keywords = skill.keywords.split(',').map((k: string) => k.trim())
          keywords.forEach((keyword: string) => {
            if (!extractedKeywords.includes(keyword)) {
              extractedKeywords.push(keyword)
            }
          })
        }
      }
    })

    // Fallback to basic extraction if no matches
    if (extractedSkills.length === 0) {
      // Basic keyword extraction from text
      const words = text.toLowerCase().match(/\b\w+\b/g) || []
      const commonSkills = ['programming', 'analysis', 'management', 'design', 'development']
      commonSkills.forEach(skill => {
        if (words.includes(skill)) {
          extractedSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1))
        }
      })
    }

    const result = {
      keywords: extractedKeywords.length > 0 ? extractedKeywords : ['data analysis', 'programming', 'research'],
      domains: extractedDomains.length > 0 ? extractedDomains : ['Technology', 'Education'],
      skills: extractedSkills.length > 0 ? extractedSkills : ['Critical Thinking', 'Problem Solving'],
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type
      }
    }

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
