import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DeveloperCredit from '@/components/DeveloperCredit';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { auth } from '@/lib/auth';
import { isAdminReadOnly } from '@/lib/permissions';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Upload, Trash2, Eye, Loader2, FileText, FolderPlus, Folder, X } from 'lucide-react';
import PDFViewer from '@/components/PDFViewer';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_ROOT = API_BASE.replace(/\/api\/?$/, '');

const buildResourceUrl = (resource: any) => {
  const direct = resource?.url;
  if (direct && /^https?:\/\//i.test(direct)) return direct;
  const fallback = direct || resource?.path || (resource?.filename ? `/uploads/resources/${resource.filename}` : '');
  if (!fallback) return '';
  return `${API_ROOT}${fallback.startsWith('/') ? fallback : `/${fallback}`}`;
};

const AdminResources = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<any[]>([]);
  const [selectedResource, setSelectedResource] = useState<any | null>(null);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [resourceType, setResourceType] = useState('TQI');
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);

  const { permissions, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }

    const user = auth.getUser();
    
    // Wait for permissions to load
    if (permissionsLoading) return;

    const isAdmin = user?.role === 'admin';
    const canAccess = isAdmin || permissions.can_manage_resources;
    if (!canAccess) {
      toast.error("You don't have permission to access resources");
      navigate(user?.role === 'office_bearer' ? "/office-bearer" : "/admin");
      return;
    }

    loadFolders();
    loadFiles();
  }, [permissions, permissionsLoading, currentFolder]);
  
  const loadFolders = async () => {
    try {
      const res = await fetch(`${API_BASE}/resources/folders`, {
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) setFolders(data.folders || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadFiles = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      // Exclude REPORT type resources - those should only show in Reports page
      queryParams.append('exclude_resource_type', 'REPORT');
      
      const res = await fetch(`${API_BASE}/resources?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        // Filter resources based on current folder and exclude REPORT type as backup
        let filtered = (data.resources || []).filter((r: any) => r.resource_type !== 'REPORT');
        if (currentFolder) {
          filtered = filtered.filter((r: any) => r.folder_id === currentFolder);
        } else {
          filtered = filtered.filter((r: any) => !r.folder_id || r.folder_id === null);
        }
        setFiles(filtered);
      } else {
        toast.error(data.message || 'Failed to load resources');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error('Folder name is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/resources/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({
          name: folderName.trim(),
          description: folderDescription.trim() || null,
          parent_id: currentFolder || null
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Folder created successfully!');
        setShowFolderModal(false);
        setFolderName('');
        setFolderDescription('');
        loadFolders();
        // Auto-select the newly created folder
        if (data.folder) {
          setCurrentFolder(data.folder.id);
          setSelectedFolder(data.folder.id);
          loadFiles();
        }
      } else {
        toast.error(data.message || 'Failed to create folder');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create folder');
    }
  };
  
  const handleDeleteFolder = async (id: number) => {
    if (!confirm('Are you sure you want to delete this folder? Resources inside will not be deleted.')) return;
    try {
      const res = await fetch(`${API_BASE}/resources/folders/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Folder deleted');
        loadFolders();
        if (currentFolder === id) {
          setCurrentFolder(null);
          loadFiles();
        }
      } else {
        toast.error(data.message || 'Delete failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Delete failed');
    }
  };

  const handleUpload = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    
    if (!title.trim()) {
      toast.error('Please enter a display name');
      return;
    }
    
    if (!resourceType.trim()) {
      toast.error('Please select a category');
      return;
    }
    
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title.trim());
      fd.append('resource_type', resourceType.trim());
      if (selectedFolder || currentFolder) {
        fd.append('folder_id', (selectedFolder || currentFolder)!.toString());
      }
      
      console.log('Uploading:', { title: title.trim(), resourceType: resourceType.trim(), file: file.name });
      
      const res = await fetch(`${API_BASE}/resources`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: fd
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Resource uploaded successfully! ✅');
        loadFiles();
        setShowModal(false);
        setTitle('');
        setResourceType('TQI');
        // Keep selectedFolder if we're inside a folder, otherwise reset
        if (!currentFolder) {
          setSelectedFolder(null);
        } else {
          setSelectedFolder(currentFolder);
        }
      } else {
        toast.error(data.message || 'Upload failed');
        console.error('Upload error response:', data);
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
      (ev.target as HTMLInputElement).value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this resource? This action cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/resources/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Resource deleted');
        loadFiles();
      } else {
        toast.error(data.message || 'Delete failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Delete failed');
    }
  };

  const friendlyType = (mime?: string) => {
    if (!mime) return 'Document';
    if (mime.includes('pdf')) return 'PDF';
    if (mime.includes('word') || mime.includes('officedocument')) return 'Word';
    return mime.split('/').pop()?.toUpperCase() || 'Document';
  };

  const resourceCategories = [
    'TQI',
    'BHUMI',
    'SM',
    'FORMAT',
    'ATCHAYAM',
    'CONTENT TEAM'
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <Header />
      <DeveloperCredit />
      
      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="hidden lg:block sticky top-[57px] h-[calc(100vh-57px)] bg-white dark:bg-slate-900 shadow-sm">
          <Sidebar />
        </div>
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {currentFolder && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentFolder(null);
                        setSelectedFolder(null);
                        loadFiles();
                      }}
                      className="gap-2"
                    >
                      <X className="w-4 h-4" />
                      Back
                    </Button>
                  )}
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-violet bg-clip-text text-transparent">
                    Resource Management
                  </h1>
                </div>
                <p className="text-muted-foreground text-lg">Upload and manage resources for students</p>
              </div>
              {(auth.hasRole('admin') || permissions.can_manage_resources) && (
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setShowFolderModal(true)}
                    variant="outline"
                    className="gap-2 h-10 px-4 text-sm"
                  >
                    <FolderPlus className="w-4 h-4" />
                    Create Folder
                  </Button>
                  <Button 
                    onClick={() => {
                      setSelectedFolder(currentFolder);
                      setShowModal(true);
                    }}
                    disabled={uploading}
                    className="gap-2 h-10 px-4 text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Upload Resource'}
                  </Button>
                </div>
              )}
            </div>



            {/* Create Folder Modal */}
            {showFolderModal && (auth.hasRole('admin') || permissions.can_manage_resources) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <Card className="w-full max-w-md border-0 shadow-2xl">
                  <CardHeader className="border-b border-border/10 pb-4">
                    <CardTitle>Create New Folder</CardTitle>
                    <CardDescription>Organize your resources into folders</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Folder Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="text"
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        placeholder="e.g., Study Materials"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Description (Optional)
                      </label>
                      <Input
                        type="text"
                        value={folderDescription}
                        onChange={(e) => setFolderDescription(e.target.value)}
                        placeholder="Brief description of folder contents"
                        className="h-10"
                      />
                    </div>
                    <div className="pt-4 border-t border-border/10 flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setShowFolderModal(false);
                          setFolderName('');
                          setFolderDescription('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateFolder}
                        disabled={!folderName.trim()}
                      >
                        Create Folder
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Upload Modal */}
            {showModal && (auth.hasRole('admin') || permissions.can_manage_resources) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <Card className="w-full max-w-md border-0 shadow-2xl">
                  <CardHeader className="border-b border-border/10 pb-4">
                    <CardTitle>Upload New Resource</CardTitle>
                    <CardDescription>Fill in the details and select a file</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Display Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Python Basics Guide"
                        className="h-10"
                      />
                      {title.trim() === '' && (
                        <div className="text-xs text-destructive mt-1">Display name is required</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Category <span className="text-destructive">*</span>
                      </label>
                      <select 
                        value={resourceType} 
                        onChange={(e) => setResourceType(e.target.value)} 
                        className="w-full h-10 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {resourceCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Folder (Optional)
                      </label>
                      <select 
                        value={selectedFolder || currentFolder || ''} 
                        onChange={(e) => setSelectedFolder(e.target.value ? parseInt(e.target.value) : null)} 
                        className="w-full h-10 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">No Folder (Root)</option>
                        {folders.map(folder => (
                          <option key={folder.id} value={folder.id}>{folder.name}</option>
                        ))}
                      </select>
                      {currentFolder && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Currently in: {folders.find(f => f.id === currentFolder)?.name || 'Folder'}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-border/10 flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setShowModal(false);
                          setTitle('');
                          setResourceType('TQI');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        disabled={!resourceType || !(title && title.trim() !== '')}
                        onClick={() => {
                          setShowModal(false);
                          const el = document.getElementById('resource-file-input') as HTMLInputElement | null;
                          if (el) el.click();
                        }}
                        className="gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Choose File
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Hidden file input */}
            {(auth.hasRole('admin') || permissions.can_manage_resources) && (
            <input 
              id="resource-file-input" 
              type="file" 
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              onChange={handleUpload} 
              className="hidden" 
            />
            )}

            {/* Folders List */}
            {!currentFolder && folders.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-4">Folders</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {folders.map((folder) => (
                    <Card 
                      key={folder.id} 
                      className="cursor-pointer hover:shadow-lg transition-all border-0 shadow-md bg-white dark:bg-slate-800"
                      onClick={() => {
                        setCurrentFolder(folder.id);
                        setSelectedFolder(folder.id);
                        loadFiles();
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Folder className="w-5 h-5 text-primary flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{folder.name}</p>
                              {folder.description && (
                                <p className="text-xs text-muted-foreground truncate">{folder.description}</p>
                              )}
                            </div>
                          </div>
                          {(auth.hasRole('admin') || permissions.can_manage_resources) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFolder(folder.id);
                              }}
                              className="h-6 w-6 p-0 flex-shrink-0"
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                        {(auth.hasRole('admin') || permissions.can_manage_resources) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentFolder(folder.id);
                              setSelectedFolder(folder.id);
                              setShowModal(true);
                            }}
                          >
                            <Upload className="w-4 h-4" />
                            Upload File
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Resources List */}
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {currentFolder ? `Resources in "${folders.find(f => f.id === currentFolder)?.name || 'Folder'}"` : 'Uploaded Resources'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">{files.length} {files.length === 1 ? 'resource' : 'resources'} available</p>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : files.length === 0 ? (
                <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
                  <CardContent className="p-12 text-center">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground text-lg">No resources uploaded yet</p>
                    <p className="text-sm text-muted-foreground mt-2">Click "Upload Resource" to add your first file</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {files.map((f) => {
                    const fileUrl = buildResourceUrl(f);
                    const downloadName = f.original_name || f.title || 'resource';
                    const category = f.resource_type || 'Miscellaneous';
                    
                    return (
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
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {friendlyType(f.mime_type)}
                                  </Badge>
                                  <Badge className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs">
                                    {category}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                          <CardDescription className="text-xs mt-2">
                            Uploaded {f.created_at ? new Date(f.created_at).toLocaleDateString() : 'Unknown date'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="flex gap-2">
                            {fileUrl && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 gap-2"
                                onClick={() => {
                                  setSelectedResource({ ...f, url: fileUrl });
                                  setShowPDFViewer(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </Button>
                            )}
                            {(auth.hasRole('admin') || permissions.can_manage_resources) && (
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDelete(f.id)}
                              className="gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="h-16"></div>
        </main>
      </div>

      <Footer />

      {/* PDF Viewer */}
      {selectedResource && (
        <PDFViewer
          open={showPDFViewer}
          onOpenChange={setShowPDFViewer}
          resource={selectedResource}
          onUpdate={loadFiles}
          canEdit={auth.hasRole('admin') || permissions.can_manage_resources}
        />
      )}
    </div>
  );
};

export default AdminResources;
