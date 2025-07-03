
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Hash, Globe, Target, FileText, Loader2, Copy, Check, 
  TrendingUp, Award, Filter, ChevronDown, ChevronUp, Info 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AnalysisResult, SkillMatch } from '@/pages/Index';

interface EnhancedAnalysisResultsProps {
  result: AnalysisResult | null;
  isLoading: boolean;
}

export const EnhancedAnalysisResults: React.FC<EnhancedAnalysisResultsProps> = ({ result, isLoading }) => {
  const { toast } = useToast();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());

  const copyToClipboard = async (items: string[], sectionName: string) => {
    try {
      await navigator.clipboard.writeText(items.join(', '));
      setCopiedSection(sectionName);
      toast({
        title: "Copied to clipboard",
        description: `${sectionName} copied as comma-separated list`,
      });
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const toggleSkillExpansion = (skillName: string) => {
    const newExpanded = new Set(expandedSkills);
    if (newExpanded.has(skillName)) {
      newExpanded.delete(skillName);
    } else {
      newExpanded.add(skillName);
    }
    setExpandedSkills(newExpanded);
  };

  const getFilteredSkills = (skills: SkillMatch[]) => {
    if (filterCategory === 'all') return skills;
    return skills.filter(skill => skill.category === filterCategory);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'technical': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'functional': return 'bg-green-100 text-green-800 border-green-200';
      case 'soft': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-green-600';
    if (confidence >= 40) return 'text-yellow-600';
    return 'text-orange-600';
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="text-center mb-8">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-2xl font-semibold text-slate-800 mb-2">Advanced Analysis in Progress</h3>
          <p className="text-slate-600">Processing your file with comprehensive skill extraction from thousands of skills in our taxonomy...</p>
        </div>
        
        <div className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-12 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!result) return null;

  const categories = ['all', ...new Set(result.skills.map(s => s.category))];
  const filteredSkills = getFilteredSkills(result.skills);
  const highConfidenceSkills = result.skills.filter(s => s.confidence >= 50);
  const mediumConfidenceSkills = result.skills.filter(s => s.confidence >= 25 && s.confidence < 50);

  return (
    <div className="space-y-8">
      {/* File Info & Summary */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <FileText className="h-6 w-6 text-blue-600" />
          <h3 className="text-xl font-semibold text-slate-800">Analysis Complete</h3>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">File:</span>
              <span className="font-medium text-slate-800">{result.fileInfo.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Size:</span>
              <span className="font-medium text-slate-800">{result.fileInfo.sizeFormatted}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Type:</span>
              <span className="font-medium text-slate-800">{result.fileInfo.type}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Skills Found:</span>
              <span className="font-medium text-slate-800">{result.metadata.skillsFound}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">High Confidence (≥50%):</span>
              <span className="font-medium text-green-600">{highConfidenceSkills.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Medium Confidence (25-49%):</span>
              <span className="font-medium text-yellow-600">{mediumConfidenceSkills.length}</span>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
          <p className="text-sm text-blue-800">{result.summary}</p>
        </div>

        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-start space-x-2">
            <Info className="h-4 w-4 text-amber-600 mt-0.5" />
            <p className="text-xs text-amber-800">
              <strong>Quality Filter Applied:</strong> Only showing skills with confidence levels above 10%. 
              This ensures higher accuracy by filtering out weak matches and focusing on clearly identified skills.
            </p>
          </div>
        </div>
      </Card>

      {/* Main Analysis */}
      <Tabs defaultValue="skills" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="skills" className="flex items-center space-x-2">
            <Target className="h-4 w-4" />
            <span>Skills Analysis</span>
          </TabsTrigger>
          <TabsTrigger value="domains" className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <span>Domains</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="space-y-6">
          {/* Skills Filter */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-slate-800">Filter by Category</h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(filteredSkills.map(s => s.name), 'Skills')}
              >
                {copiedSection === 'Skills' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span className="ml-1">Copy All</span>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <Button
                  key={category}
                  size="sm"
                  variant={filterCategory === category ? "default" : "outline"}
                  onClick={() => setFilterCategory(category)}
                  className="capitalize"
                >
                  {category} {category !== 'all' && `(${result.skills.filter(s => s.category === category).length})`}
                </Button>
              ))}
            </div>
          </Card>

          {/* Skills List */}
          <div className="grid gap-4">
            {filteredSkills.map((skill, index) => (
              <Card key={`${skill.name}-${index}`} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <Award className="h-4 w-4 text-amber-600" />
                      <span className="font-medium text-slate-800">{skill.name}</span>
                    </div>
                    <Badge className={`text-xs ${getCategoryColor(skill.category)}`}>
                      {skill.category}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right text-xs">
                      <div className="text-slate-600">Matches: {skill.frequency}</div>
                      <div className={`font-medium ${getConfidenceColor(skill.confidence)}`}>
                        {skill.confidence}% confidence
                      </div>
                    </div>
                    {skill.contexts.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleSkillExpansion(skill.name)}
                      >
                        {expandedSkills.has(skill.name) ? 
                          <ChevronUp className="h-3 w-3" /> : 
                          <ChevronDown className="h-3 w-3" />
                        }
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span>Confidence Level</span>
                    <span className={getConfidenceColor(skill.confidence)}>{skill.confidence}%</span>
                  </div>
                  <Progress value={skill.confidence} className="h-2" />
                </div>

                {expandedSkills.has(skill.name) && skill.contexts.length > 0 && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <h5 className="text-xs font-medium text-slate-700 mb-2">Context Examples:</h5>
                    <div className="space-y-2">
                      {skill.contexts.map((context, idx) => (
                        <p key={idx} className="text-xs text-slate-600 italic">
                          "...{context}..."
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="domains" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Globe className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Identified Domains</h3>
                  <p className="text-sm text-slate-500">Subject areas and fields of expertise</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(result.domains, 'Domains')}
              >
                {copiedSection === 'Domains' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {result.domains.map((domain, index) => (
                <div 
                  key={index}
                  className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-emerald-800">{domain}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
