
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
  fileInfo: {
    name: string;
    size: number;
    type: string;
  };
}

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
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

      // Call Supabase edge function
      const { data, error } = await supabase.functions.invoke('analyze-course', {
        body: formData,
      });

      if (error) {
        throw error;
      }

      setAnalysisResult(data);
      
      toast({
        title: "Analysis Complete",
        description: "Course content has been successfully analyzed using your skill taxonomy.",
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
