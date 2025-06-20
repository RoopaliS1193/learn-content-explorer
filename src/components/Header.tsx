
import React from 'react';
import { BookOpen, Sparkles } from 'lucide-react';

export const Header = () => {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <Sparkles className="h-4 w-4 text-emerald-500 absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Course Analyzer</h1>
              <p className="text-sm text-slate-500">Intelligent Content Analysis</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-6 text-sm text-slate-600">
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span>AI-Powered</span>
            </span>
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Multi-Format Support</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
