
import React, { useState } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { EnhancedAnalysisResults } from '@/components/EnhancedAnalysisResults';
import { Header } from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface SkillMatch {
  name: string;
  frequency: number;
  category: string;
  confidence: number;
  contexts: string[];
}

export interface AnalysisResult {
  skills: SkillMatch[];
  domains: string[];
  summary: string;
  metadata: {
    textLength: number;
    skillsFound: number;
    processedAt: string;
  };
  fileInfo: {
    name: string;
    size: number;
    type: string;
    sizeFormatted: string;
  };
}

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const handleFileAnalysis = async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      console.log('Starting file analysis for:', file.name);
      
      // Create FormData to send the file to the edge function
      const formData = new FormData();
      formData.append('file', file);

      // Call the enhanced Supabase edge function
      const { data, error } = await supabase.functions.invoke('analyze-skills', {
        body: formData,
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Analysis failed');
      }

      console.log('Analysis result:', data);
      setAnalysisResult(data);
      
      toast({
        title: "Analysis Complete",
        description: `Found ${data.skills?.length || 0} skills across ${data.domains?.length || 0} domains from your ${data.fileInfo?.sizeFormatted || 'file'}.`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed", 
        description: error instanceof Error ? error.message : "There was an error analyzing the file. Please try again.",
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
              AI Skills Extractor
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Upload your documents and get comprehensive skill analysis with taxonomy matching, 
              frequency analysis, and contextual insights. Supports large files up to 50MB.
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
            <EnhancedAnalysisResults 
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
