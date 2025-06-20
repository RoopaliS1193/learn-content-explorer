
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Database, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface TaxonomyUploaderProps {
  onUpload: (data: any) => void;
}

export const TaxonomyUploader: React.FC<TaxonomyUploaderProps> = ({ onUpload }) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploaded, setIsUploaded] = useState(false);

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    }).filter(row => Object.values(row).some(val => val !== ''));
    
    return { headers, data };
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setUploadedFile(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let data;
          if (file.type === 'application/json') {
            data = JSON.parse(e.target?.result as string);
          } else {
            data = parseCSV(e.target?.result as string);
          }
          
          onUpload(data);
          setIsUploaded(true);
        } catch (error) {
          console.error('Error parsing file:', error);
        }
      };
      
      reader.readAsText(file);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive, rejectedFiles } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json']
    },
    maxFiles: 1
  });

  return (
    <Card className="p-6">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-slate-400'}
          ${isUploaded ? 'border-emerald-500 bg-emerald-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-3">
          {isUploaded ? (
            <CheckCircle className="h-10 w-10 text-emerald-600" />
          ) : (
            <Database className="h-10 w-10 text-slate-400" />
          )}
          
          <div>
            <p className="font-medium text-slate-700">
              {isUploaded ? 'Taxonomy Uploaded' : 'Upload Skill Taxonomy'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              CSV or JSON format with skill categories
            </p>
          </div>
        </div>
      </div>

      {rejectedFiles.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Please upload a CSV or JSON file.</span>
          </div>
        </div>
      )}

      {uploadedFile && isUploaded && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-center space-x-2 text-emerald-700">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">
              <strong>{uploadedFile.name}</strong> loaded successfully
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};
