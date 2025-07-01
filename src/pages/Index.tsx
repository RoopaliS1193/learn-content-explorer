import React, { useState } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { AnalysisResults } from '@/components/AnalysisResults';
import { Header } from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@supabase/supabase-js';

export interface AnalysisResult {
  keywords: string[];
  domains: string[];
  skills: string[];
  skillSources?: Array<{skill: string, source: string}>;
  fileInfo: {
    name: string;
    size: number;
    type: string;
  };
}

// Use the actual Supabase project credentials
const supabase = createClient(
  'https://kgaiqhszcjiquxcwxxbs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnYWlxaHN6Y2ppcXV4Y3d4eGJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3NjYyODksImV4cCI6MjA2NjM0MjI4OX0.OikYe9LLX-0eKhG4sPH7e1IOpNtWiZkRYPJdF2yJpb4'
);

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const handleFileAnalysis = async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Create form data to send file to edge function
      const formData = new FormData();
      formData.append('file', file);

      console.log('Calling analyze-course function with file:', file.name);

      // Call Supabase edge function
      const { data, error } = await supabase.functions.invoke('analyze-course', {
        body: formData,
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      console.log('Analysis result:', data);
      setAnalysisResult(data);
      
      toast({
        title: "Analysis Complete",
        description: `Found ${data.skills?.length || 0} skills from your taxonomy that match the course content.`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed", 
        description: "There was an error analyzing the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
              Course Content Analyzer
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Upload your course materials and get intelligent keyword suggestions, 
              domain classifications, and skill mappings powered by your custom taxonomy.
            </p>
          </div>

          {/* Upload Section */}
          <div className="mb-12">
            <FileUploader 
              onFileSelect={handleFileAnalysis}
              isProcessing={isAnalyzing}
            />
          </div>

          {/* Results Section */}
          {(isAnalyzing || analysisResult) && (
            <AnalysisResults 
              result={analysisResult}
              isLoading={isAnalyzing}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
