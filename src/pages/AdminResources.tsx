import React, { useEffect, useState } from 'react';
import DeveloperCredit from '@/components/DeveloperCredit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { auth } from '@/lib/auth';
import { isAdminReadOnly } from '@/lib/permissions';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Upload, Trash2, Eye, Loader2, FileText, FolderPlus, Folder, ArrowLeft } from 'lucide-react';
import PDFViewer from '@/components/PDFViewer';
import { BackButton } from '@/components/BackButton';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
      // Load folders that are NOT for reports (exclude REPORT type)
      const res = await fetch(`${API_BASE}/resources/folders`, {
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        // Filter out REPORT type folders on frontend as well
        // Include folders with null resource_type (for backward compatibility) and exclude REPORT type
        const filtered = (data.folders || []).filter((f: any) => f.resource_type !== 'REPORT');
        setFolders(filtered);
      }
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
          parent_id: currentFolder || null,
          resource_type: null // Resources folders (not REPORT)
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter a display name');
      return;
    }

    if (!resourceType.trim()) {
      toast.error('Please select a category');
      return;
    }

    const file = selectedFile;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title.trim());
      fd.append('resource_type', resourceType.trim());
      if (currentFolder) {
        fd.append('folder_id', currentFolder.toString());
      }

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
        setSelectedFile(null);
        if (!currentFolder) {
          setSelectedFolder(null);
        } else {
          setSelectedFolder(currentFolder);
        }
      } else {
        toast.error(data.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
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
    <div className="flex-1 flex flex-col">
      <DeveloperCredit />

      <main className="flex-1 p-4 md:p-8 bg-transparent overflow-y-auto">
        <div className="w-full px-4 md:px-6 lg:px-8">

          <BackButton to="/admin" className="mb-6" />

          {/* Hero Header Section */}
          <div className="mb-8 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-8 shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2 text-foreground">Resource Management</h1>
                <p className="text-lg text-muted-foreground">Upload and manage resources for students</p>
              </div>
              {(auth.hasRole('admin') || permissions.can_manage_resources) && (
                <div className="flex gap-3">
                  {!currentFolder ? (
                    <Button
                      onClick={() => setShowFolderModal(true)}
                      className="gap-2 bg-primary hover:bg-primary/90"
                    >
                      <FolderPlus className="w-4 h-4" />
                      Create Folder
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setShowFolderModal(true)}
                        variant="outline"
                        className="gap-2"
                      >
                        <FolderPlus className="w-4 h-4" />
                        Subfolder
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedFolder(currentFolder);
                          setShowModal(true);
                        }}
                        className="gap-2 bg-primary hover:bg-primary/90"
                        disabled={uploading}
                      >
                        <Upload className="w-4 h-4" />
                        Upload Resource
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Breadcrumb */}
          {currentFolder && (
            <div className="mb-4 flex items-center gap-2">
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
                <ArrowLeft className="w-4 h-4" />
                Back to Root
              </Button>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">{folders.find(f => f.id === currentFolder)?.name || 'Folder'}</span>
            </div>
          )}

          <div className="w-full">
            {!currentFolder ? (
              /* Root View: Folders Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {loading ? (
                  <div className="col-span-full text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                    <p className="text-muted-foreground">Loading folders...</p>
                  </div>
                ) : folders.filter(f => {
                  const matchesFolder = !f.parent_id;
                  const matchesType = f.resource_type !== 'REPORT';
                  return matchesFolder && matchesType;
                }).length === 0 ? (
                  <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl bg-card/30">
                    <Folder className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">No folders yet</p>
                    <p className="text-sm text-muted-foreground mb-6">Create your first folder to start organizing resources</p>
                    {(auth.hasRole('admin') || permissions.can_manage_resources) && (
                      <Button
                        variant="outline"
                        onClick={() => setShowFolderModal(true)}
                        className="gap-2"
                      >
                        <FolderPlus className="w-4 h-4" />
                        Create Folder
                      </Button>
                    )}
                  </div>
                ) : (
                  folders
                    .filter(f => {
                      const matchesFolder = !f.parent_id;
                      const matchesType = f.resource_type !== 'REPORT';
                      return matchesFolder && matchesType;
                    })
                    .map((folder) => (
                      <Card
                        key={folder.id}
                        className="group hover:border-primary/50 transition-all cursor-pointer hover:shadow-lg bg-card/50 backdrop-blur-sm"
                        onClick={() => {
                          setCurrentFolder(folder.id);
                          setSelectedFolder(folder.id);
                          loadFiles();
                        }}
                      >
                        <CardContent className="p-5">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between">
                              <div className="p-2.5 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                <Folder className="w-6 h-6" />
                              </div>
                              {(auth.hasRole('admin') || permissions.can_manage_resources) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFolder(folder.id);
                                  }}
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                            <div className="space-y-1">
                              <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                                {folder.name}
                              </h3>
                              {folder.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">{folder.description}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            ) : (
              /* Folder View: Files List */
              <Card className="bg-card/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">
                      {folders.find(f => f.id === currentFolder)?.name || 'Folder Contents'}
                    </CardTitle>
                    <CardDescription>
                      Viewing resources in this folder
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="text-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                      <p className="text-muted-foreground">Loading files...</p>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="py-20 text-center">
                      <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-lg font-medium text-muted-foreground">No resources here</p>
                      <p className="text-sm text-muted-foreground mb-6">Start by uploading a resource to this folder</p>
                      {(auth.hasRole('admin') || permissions.can_manage_resources) && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedFolder(currentFolder);
                            setShowModal(true);
                          }}
                          className="gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Upload Resource
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                {file.title || file.original_name}
                              </p>
                              <p className="text-xs text-muted-foreground font-medium">
                                {file.created_at ? new Date(file.created_at).toLocaleDateString() : 'Unknown date'}
                                {file.resource_type && ` • ${file.resource_type}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const fileUrl = buildResourceUrl(file);
                                if (fileUrl) {
                                  setSelectedResource({ ...file, url: fileUrl });
                                  setShowPDFViewer(true);
                                }
                              }}
                              className="h-8 rounded-full px-4"
                            >
                              View Resource
                            </Button>
                            {(auth.hasRole('admin') || permissions.can_manage_resources) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(file.id)}
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Create Folder Dialog */}
        <Dialog open={showFolderModal} onOpenChange={setShowFolderModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>Create a folder to organize your resources</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="folder-name">Folder Name *</Label>
                <Input
                  id="folder-name"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Enter folder name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="folder-desc">Description (Optional)</Label>
                <Textarea
                  id="folder-desc"
                  value={folderDescription}
                  onChange={(e) => setFolderDescription(e.target.value)}
                  placeholder="Enter folder description"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowFolderModal(false);
                  setFolderName('');
                  setFolderDescription('');
                }}>
                  Cancel
                </Button>
                <Button onClick={handleCreateFolder} disabled={!folderName.trim()}>
                  Create Folder
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Upload Resource Dialog */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Resource</DialogTitle>
              <DialogDescription>Fill in the details and select a file</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="resource-title">Display Name *</Label>
                <Input
                  id="resource-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter display name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resource-category">Category *</Label>
                <Input
                  id="resource-category"
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value.toUpperCase())}
                  placeholder="e.g. TQI, SM, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resource-file-input">Select File *</Label>
                <Input
                  id="resource-file-input"
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  onChange={handleFileSelect}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowModal(false);
                  setTitle('');
                  setResourceType('TQI');
                  setSelectedFile(null);
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !selectedFile || !resourceType || !title.trim()}
                  className="gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>

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
