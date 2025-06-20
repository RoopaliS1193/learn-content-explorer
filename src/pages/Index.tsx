
import React, { useState } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { TaxonomyUploader } from '@/components/TaxonomyUploader';
import { AnalysisResults } from '@/components/AnalysisResults';
import { Header } from '@/components/Header';
import { useToast } from '@/hooks/use-toast';

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

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [taxonomyData, setTaxonomyData] = useState<any>(null);
  const { toast } = useToast();

  const handleFileAnalysis = async (file: File) => {
    if (!taxonomyData) {
      toast({
        title: "Taxonomy Required",
        description: "Please upload a skill taxonomy file first.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Simulate processing time for demo
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock analysis results - in a real app, this would call your backend
      const mockResult: AnalysisResult = {
        keywords: [
          "machine learning algorithms",
          "data preprocessing",
          "statistical analysis",
          "predictive modeling",
          "feature engineering",
          "neural networks",
          "regression analysis",
          "classification techniques",
          "data visualization",
          "model evaluation"
        ],
        domains: [
          "Data Science",
          "Machine Learning",
          "Statistics",
          "Artificial Intelligence",
          "Business Analytics"
        ],
        skills: [
          "Python Programming",
          "Statistical Modeling",
          "Data Analysis",
          "Machine Learning Implementation",
          "Data Visualization",
          "Problem Solving",
          "Critical Thinking",
          "Research Methodology"
        ],
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type
        }
      };

      setAnalysisResult(mockResult);
      
      toast({
        title: "Analysis Complete",
        description: "Course content has been successfully analyzed.",
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "There was an error analyzing the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTaxonomyUpload = (data: any) => {
    setTaxonomyData(data);
    toast({
      title: "Taxonomy Loaded",
      description: "Skill taxonomy has been successfully uploaded.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
              Course Content Analyzer
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Upload your course materials and get intelligent keyword suggestions, 
              domain classifications, and skill mappings for improved discoverability.
            </p>
          </div>

          {/* Upload Section */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-slate-800">1. Upload Skill Taxonomy</h2>
              <TaxonomyUploader onUpload={handleTaxonomyUpload} />
            </div>
            
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-slate-800">2. Upload Course File</h2>
              <FileUploader 
                onFileSelect={handleFileAnalysis}
                isProcessing={isAnalyzing}
                disabled={!taxonomyData}
              />
            </div>
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
