
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Hash, Globe, Target, FileText, Loader2 } from 'lucide-react';
import type { AnalysisResult } from '@/pages/Index';

interface AnalysisResultsProps {
  result: AnalysisResult | null;
  isLoading: boolean;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ result, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="text-center mb-8">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-2xl font-semibold text-slate-800 mb-2">Analyzing Content</h3>
          <p className="text-slate-600">Processing your course file and extracting insights...</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((j) => (
                  <Skeleton key={j} className="h-8 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-8">
      {/* File Info */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <FileText className="h-6 w-6 text-blue-600" />
          <h3 className="text-xl font-semibold text-slate-800">Analysis Complete</h3>
        </div>
        <div className="flex items-center space-x-6 text-sm text-slate-600">
          <span><strong>File:</strong> {result.fileInfo.name}</span>
          <span><strong>Size:</strong> {(result.fileInfo.size / 1024 / 1024).toFixed(2)} MB</span>
          <span><strong>Type:</strong> {result.fileInfo.type}</span>
        </div>
      </Card>

      {/* Results Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Keywords Section */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Hash className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Keywords</h3>
              <p className="text-sm text-slate-500">For improved discoverability</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {result.keywords.map((keyword, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="mr-2 mb-2 bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                {keyword}
              </Badge>
            ))}
          </div>
        </Card>

        {/* Domains Section */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Globe className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Domains</h3>
              <p className="text-sm text-slate-500">Subject areas covered</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {result.domains.map((domain, index) => (
              <div 
                key={index}
                className="p-3 bg-emerald-50 rounded-lg border border-emerald-200"
              >
                <span className="font-medium text-emerald-800">{domain}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Skills Section */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Skills</h3>
              <p className="text-sm text-slate-500">Learning outcomes</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {result.skills.map((skill, index) => (
              <div 
                key={index}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-slate-700">{skill}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
