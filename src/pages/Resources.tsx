import React, { useEffect, useState } from 'react';
import DeveloperCredit from '@/components/DeveloperCredit';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { auth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileText, Download, Eye, Loader2, BookMarked, Lightbulb, DollarSign, FileCheck, Briefcase } from 'lucide-react';
import PDFViewer from '@/components/PDFViewer';
import { BackButton } from '@/components/BackButton';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Resource {
  id: number;
  title?: string;
  original_name?: string;
  mime_type?: string;
  resource_type?: string;
  url?: string;
  created_at?: string;
  category?: string;
}

const RESOURCE_CATEGORIES = [
  { name: 'Academic', icon: BookOpen, color: 'bg-blue-100 dark:bg-blue-950', iconColor: 'text-blue-600 dark:text-blue-400' },
  { name: 'Examination', icon: FileCheck, color: 'bg-purple-100 dark:bg-purple-950', iconColor: 'text-purple-600 dark:text-purple-400' },
  { name: 'Research', icon: Lightbulb, color: 'bg-green-100 dark:bg-green-950', iconColor: 'text-green-600 dark:text-green-400' },
  { name: 'Finance', icon: DollarSign, color: 'bg-amber-100 dark:bg-amber-950', iconColor: 'text-amber-600 dark:text-amber-400' },
  { name: 'FPR', icon: Briefcase, color: 'bg-pink-100 dark:bg-pink-950', iconColor: 'text-pink-600 dark:text-pink-400' },
  { name: 'Miscellaneous', icon: FileText, color: 'bg-slate-100 dark:bg-slate-800', iconColor: 'text-slate-600 dark:text-slate-400' }
];

const Resources = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showPDFViewer, setShowPDFViewer] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      // Exclude REPORT type resources - those should only show in Reports page
      queryParams.append('exclude_resource_type', 'REPORT');

      const res = await fetch(`${API_BASE}/resources?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        // Also filter out REPORT type on frontend as backup
        const filtered = (data.resources || []).filter((r: any) => r.resource_type !== 'REPORT');
        setFiles(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const friendlyType = (mime?: string) => {
    if (!mime) return 'Document';
    if (mime.includes('pdf')) return 'PDF';
    if (mime.includes('word') || mime.includes('officedocument')) return 'Word';
    return mime.split('/').pop()?.toUpperCase() || 'Document';
  };

  const groupedResources = RESOURCE_CATEGORIES.reduce((acc, cat) => {
    acc[cat.name] = files.filter(f => (f.resource_type || f.category || 'Miscellaneous') === cat.name);
    return acc;
  }, {} as Record<string, Resource[]>);

  const filteredFiles = files;

  return (
    <div className="flex-1 flex flex-col bg-transparent">
      <DeveloperCredit />

      <div className="flex flex-1">

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">

            {/* Page Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-foreground mb-1">Resources</h1>
                <p className="text-sm text-muted-foreground">Access study materials, guides, and documentation</p>
              </div>
              <BackButton />
            </div>

            {/* Resources List */}
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">All Resources</h2>
                <p className="text-sm text-muted-foreground mt-1">{filteredFiles.length} {filteredFiles.length === 1 ? 'resource' : 'resources'} available</p>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredFiles.length === 0 ? (
                <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
                  <CardContent className="p-12 text-center">
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground text-lg">
                      No resources available yet
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredFiles.map((f) => (
                    <Card key={f.id} className="border-0 shadow-md hover:shadow-lg transition-all bg-white dark:bg-slate-800">
                      <CardHeader className="border-b border-border/10 pb-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* SM Logo Icon */}
                            <div className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-orange-500/20 to-rose-500/20 rounded-lg flex items-center justify-center border-2 border-orange-200 dark:border-orange-800">
                              <img
                                src="/Images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                                alt="SM Logo"
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="truncate text-base">{f.title || f.original_name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {f.created_at ? new Date(f.created_at).toLocaleDateString() : 'Unknown date'}
                                {f.resource_type && ` • ${f.resource_type}`}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant="secondary" className="flex-shrink-0">
                            {friendlyType(f.mime_type)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="flex gap-2">
                          {f.url && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                              onClick={() => {
                                setSelectedResource(f);
                                setShowPDFViewer(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>


      {/* PDF Viewer */}
      {selectedResource && (
        <PDFViewer
          open={showPDFViewer}
          onOpenChange={setShowPDFViewer}
          resource={selectedResource}
          onUpdate={loadFiles}
          canEdit={false}
        />
      )}
    </div>
  );
};

export default Resources;
