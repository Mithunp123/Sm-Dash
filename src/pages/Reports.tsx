import React, { useEffect, useState } from 'react';
import DeveloperCredit from '@/components/DeveloperCredit';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { auth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { Upload, FolderPlus, Folder, FileText, Trash2, ArrowLeft, Loader2, Search, Edit } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_ROOT = API_BASE.replace(/\/api\/?$/, '');
const REPORT_TYPES = [
  { value: 'MINUTES_OF_MEET', label: 'Minutes of Meet' },
  { value: 'REPORT', label: 'Report' },
  { value: 'PERMISSION_LETTER', label: 'Permission Letter' }
];

const Reports = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);

  // Folder creation state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [folderCategory, setFolderCategory] = useState('REPORT');
  const [customCategory, setCustomCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingFolder, setEditingFolder] = useState<any | null>(null);
  const [isFolderDisabled, setIsFolderDisabled] = useState(false);

  const CATEGORIES = [
    'TQI', 'BHUMI', 'SM', 'FORMAT', 'ATCHAYAM', 'CONTENT TEAM', 'REPORT'
  ];

  // File upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [fileTitle, setFileTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [uploadTime, setUploadTime] = useState<string>(new Date().toTimeString().slice(0, 5));
  const [activeType, setActiveType] = useState<string>('REPORT');

  // Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Auto-update time effect
  useEffect(() => {
    if (showUploadModal) {
      const now = new Date();
      setUploadDate(now.toISOString().split('T')[0]);
      setUploadTime(now.toTimeString().slice(0, 5));
    }
  }, [showUploadModal]);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
      return;
    }
    loadFolders();
    loadFiles();
  }, [currentFolder, searchQuery, activeType]);

  const loadFolders = async () => {
    try {
      const res = await fetch(`${API_BASE}/resources/folders?resource_type=${activeType}`, {
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load folders');
    }
  };

  const loadFiles = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.append('resource_type', activeType);

      const res = await fetch(`${API_BASE}/resources?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        let filtered = data.resources || [];
        if (currentFolder) {
          filtered = filtered.filter((r: any) => r.folder_id === currentFolder);
        } else {
          filtered = filtered.filter((r: any) => !r.folder_id || r.folder_id === null);
        }
        setFiles(filtered);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFolder = async () => {
    if (!folderName.trim()) {
      toast.error('Folder name is required');
      return;
    }

    const finalCategory = isAddingCategory ? customCategory.trim() : folderCategory;
    if (isAddingCategory && !customCategory.trim()) {
      toast.error('Please enter a custom category name');
      return;
    }

    try {
      const description = (isFolderDisabled ? '[DISABLED] ' : '') + folderDescription.trim();
      let res;

      if (editingFolder) {
        res = await fetch(`${API_BASE}/resources/folders/${editingFolder.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.getToken()}`
          },
          body: JSON.stringify({
            name: folderName.trim(),
            description: description || null,
            category: activeType === 'REPORT' ? 'REPORT' : 'SM'
          })
        });
      } else {
        res = await fetch(`${API_BASE}/resources/folders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.getToken()}`
          },
          body: JSON.stringify({
            name: folderName.trim(),
            description: description || null,
            parent_id: currentFolder || null,
            resource_type: activeType,
            category: activeType === 'REPORT' ? 'REPORT' : 'SM'
          })
        });
      }

      const data = await res.json();
      if (data.success) {
        toast.success(editingFolder ? 'Folder updated successfully!' : 'Folder created successfully!');
        setShowFolderModal(false);
        setEditingFolder(null);
        setFolderName('');
        setFolderDescription('');
        setCustomCategory('');
        setIsFolderDisabled(false);
        setIsAddingCategory(false);
        loadFolders();
        if (data.folder && !editingFolder) {
          setCurrentFolder(data.folder.id);
          loadFiles();
        }
      } else {
        toast.error(data.message || 'Operation failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Operation failed');
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
      if (!fileTitle.trim()) {
        setFileTitle(file.name);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    if (!fileTitle.trim()) {
      toast.error('Please enter a display name');
      return;
    }

    setUploading(true);
    try {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().slice(0, 8);

      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('title', fileTitle.trim());
      fd.append('resource_type', activeType);
      fd.append('upload_date', uploadDate || currentDate);
      fd.append('upload_time', (uploadTime || currentTime).length === 5 ? `${uploadTime || currentTime}:00` : (uploadTime || currentTime));
      if (selectedFolderId || currentFolder) {
        fd.append('folder_id', (selectedFolderId || currentFolder)!.toString());
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
        toast.success('File uploaded successfully!');
        loadFiles();
        setShowUploadModal(false);
        setFileTitle('');
        setSelectedFile(null);
        setSelectedFolderId(null);
      } else {
        toast.error(data.message || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (id: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      const res = await fetch(`${API_BASE}/resources/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${auth.getToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('File deleted');
        loadFiles();
      } else {
        toast.error(data.message || 'Delete failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Delete failed');
    }
  };

  const buildFileUrl = (resource: any) => {
    const direct = resource?.url;
    if (direct && /^https?:\/\//i.test(direct)) return direct;
    const fallback = direct || resource?.path || (resource?.filename ? `/uploads/resources/${resource.filename}` : '');
    if (!fallback) return '';
    return `${API_ROOT}${fallback.startsWith('/') ? fallback : `/${fallback}`}`;
  };

  const getCurrentFolderName = () => {
    if (!currentFolder) return 'Root';
    const folder = folders.find(f => f.id === currentFolder);
    return folder?.name || 'Unknown';
  };

  const activeTypeLabel = REPORT_TYPES.find((type) => type.value === activeType)?.label || 'Report';

  return (
    <div className="flex-1 flex flex-col bg-transparent">
      <DeveloperCredit />

      <main className="flex-1 p-4 md:p-8 bg-transparent w-full overflow-y-auto">
        <div className="w-full">

          {/* Back Button */}
          <div className="mb-4">
            <BackButton />
          </div>

          {/* Page Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-1">Reports</h1>
              <p className="text-sm text-muted-foreground">Create folders and upload files by category</p>
            </div>
          </div>

          <Tabs
            value={activeType}
            onValueChange={(val) => {
              setActiveType(val);
              setCurrentFolder(null);
              setSelectedFolderId(null);
            }}
          >
            <TabsContent value={activeType} className="mt-0">
              {/* Filters and Action Buttons */}
              <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search files or folders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-3">
                  {!currentFolder ? (
                    <Button
                      onClick={() => {
                        setEditingFolder(null);
                        setFolderName('');
                        setFolderDescription('');
                        setIsFolderDisabled(false);
                        setShowFolderModal(true);
                      }}
                      className="gap-2 bg-primary hover:bg-primary/90"
                    >
                      <FolderPlus className="w-4 h-4" />
                      Create Folder
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setEditingFolder(null);
                          setFolderName('');
                          setFolderDescription('');
                          setIsFolderDisabled(false);
                          setShowFolderModal(true);
                        }}
                        variant="outline"
                        className="gap-2"
                      >
                        <FolderPlus className="w-4 h-4" />
                        Subfolder
                      </Button>
                      <Button
                        onClick={() => setShowUploadModal(true)}
                        className="gap-2 bg-primary hover:bg-primary/90"
                      >
                        <Upload className="w-4 h-4" />
                        Upload File
                      </Button>
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
                      loadFiles();
                    }}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Root
                  </Button>
                  <span className="text-muted-foreground">/</span>
                  <span className="font-medium">{getCurrentFolderName()}</span>
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
                      const matchesType = f.resource_type === activeType || f.resource_type === null;
                      const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
                      return matchesFolder && matchesType && matchesSearch;
                    }).length === 0 ? (
                      <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl bg-card/30">
                        <Folder className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-lg font-medium text-muted-foreground">No folders yet</p>
                        <p className="text-sm text-muted-foreground mb-6">Create your first folder to start organizing reports</p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingFolder(null);
                            setFolderName('');
                            setFolderDescription('');
                            setIsFolderDisabled(false);
                            setShowFolderModal(true);
                          }}
                          className="gap-2"
                        >
                          <FolderPlus className="w-4 h-4" />
                          Create Folder
                        </Button>
                      </div>
                    ) : (
                      folders
                        .filter(f => {
                          const matchesFolder = !f.parent_id;
                          const matchesType = f.resource_type === activeType || f.resource_type === null;
                          const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
                          return matchesFolder && matchesType && matchesSearch;
                        })
                        .map((folder) => (
                          <Card
                            key={folder.id}
                            className={`group hover:border-primary/50 transition-all cursor-pointer hover:shadow-lg bg-card/50 backdrop-blur-sm ${folder.description?.includes('[DISABLED]') ? 'opacity-70 bg-red-50/10' : ''}`}
                            onClick={() => {
                              const isDisabled = folder.description?.includes('[DISABLED]');
                              if (isDisabled && !auth.hasRole('admin')) {
                                toast.error("This folder is disabled");
                                return;
                              }
                              setCurrentFolder(folder.id);
                              loadFiles();
                            }}
                          >
                            <CardContent className="p-5">
                              <div className="flex flex-col gap-3">
                                <div className="flex items-start justify-between">
                                  <div className={`p-2.5 rounded-lg transition-colors ${folder.description?.includes('[DISABLED]') && !auth.hasRole('admin') ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'}`}>
                                    <Folder className="w-6 h-6" />
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteFolder(folder.id);
                                    }}
                                    className="h-8 w-8 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                                <div className="space-y-1">
                                  <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors flex items-center gap-2">
                                    {folder.name}
                                    {folder.description?.includes('[DISABLED]') && <Badge variant="destructive" className="text-[10px] h-5">Disabled</Badge>}
                                  </h3>
                                  {folder.category && (
                                    <span className="inline-block text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold uppercase tracking-wider border border-primary/20">
                                      {folder.category}
                                    </span>
                                  )}
                                  {folder.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-1">{folder.description.replace('[DISABLED]', '').trim()}</p>
                                  )}
                                </div>

                                <div className="pt-2 border-t mt-2 flex justify-end">
                                  {auth.hasRole('admin') && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingFolder(folder);
                                        setFolderName(folder.name);
                                        const isDisabled = folder.description?.includes('[DISABLED]');
                                        setIsFolderDisabled(isDisabled);
                                        setFolderDescription(folder.description ? folder.description.replace('[DISABLED]', '').trim() : '');
                                        setShowFolderModal(true);
                                      }}
                                      className="h-6 text-xs gap-1 opacity-0 group-hover:opacity-100"
                                    >
                                      <Edit className="w-3 h-3" /> Edit
                                    </Button>
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
                        <CardTitle className="text-xl">{getCurrentFolderName()}</CardTitle>
                        <CardDescription>
                          Viewing files in this folder
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {loading ? (
                        <div className="text-center py-20">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                          <p className="text-muted-foreground">Loading files...</p>
                        </div>
                      ) : files.filter(f => (f.title || f.original_name).toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                        <div className="py-20 text-center">
                          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                          <p className="text-lg font-medium text-muted-foreground">No files here</p>
                          <p className="text-sm text-muted-foreground mb-6">Start by uploading a report to this folder</p>
                          <Button
                            variant="outline"
                            onClick={() => setShowUploadModal(true)}
                            className="gap-2"
                          >
                            <Upload className="w-4 h-4" />
                            Upload File
                          </Button>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {files
                            .filter(f => (f.title || f.original_name).toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((file) => (
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
                                      {file.upload_date && file.upload_time
                                        ? `${file.upload_date} • ${file.upload_time}`
                                        : new Date(file.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(buildFileUrl(file), '_blank')}
                                    className="h-8 rounded-full px-4"
                                  >
                                    View
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = buildFileUrl(file);
                                      link.download = file.title || file.original_name;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                    className="h-8 rounded-full px-4 bg-primary/10 text-primary hover:bg-primary/20 border-none"
                                  >
                                    Download
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteFile(file.id)}
                                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>


      {/* Create/Edit Folder Dialog */}
      <Dialog open={showFolderModal} onOpenChange={setShowFolderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFolder ? 'Edit Folder' : 'Create New Folder'}</DialogTitle>
            <DialogDescription>{editingFolder ? 'Update folder details' : 'Create a folder to organize your reports'}</DialogDescription>
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
                rows={2}
              />
            </div>
            {auth.hasRole('admin') && (
              <div className="flex items-center space-x-2 py-2">
                <Checkbox
                  id="disable-folder-reports"
                  checked={isFolderDisabled}
                  onCheckedChange={(checked) => setIsFolderDisabled(checked as boolean)}
                />
                <Label htmlFor="disable-folder-reports" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Disable Access for AAGALA (Office Bearers)
                </Label>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowFolderModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveFolder}>
                {editingFolder ? 'Update Folder' : 'Create Folder'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload File Dialog */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload {activeTypeLabel} File</DialogTitle>
            <DialogDescription>Upload a file to the current folder</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Select File *</Label>
              <Input
                id="file-upload"
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-title">Display Name *</Label>
              <Input
                id="file-title"
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                placeholder="Enter display name for the file"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="upload-date">Upload Date (Auto)</Label>
                <Input
                  id="upload-date"
                  type="date"
                  value={uploadDate}
                  onChange={(e) => setUploadDate(e.target.value)}
                  className="bg-muted/50"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-time">Upload Time (Auto)</Label>
                <Input
                  id="upload-time"
                  type="time"
                  value={uploadTime}
                  onChange={(e) => setUploadTime(e.target.value)}
                  className="bg-muted/50"
                  required
                />
              </div>
            </div>
            {!currentFolder && (
              <div className="space-y-2">
                <Label htmlFor="upload-folder">Upload to Folder (Optional)</Label>
                <select
                  id="upload-folder"
                  value={selectedFolderId || ''}
                  onChange={(e) => setSelectedFolderId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">Root Folder</option>
                  {folders
                    .filter(f => f.resource_type === activeType || f.resource_type === null)
                    .map(folder => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name} {folder.category ? `(${folder.category})` : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowUploadModal(false);
                setSelectedFile(null);
                setFileTitle('');
                setUploadDate(new Date().toISOString().split('T')[0]);
                setUploadTime(new Date().toTimeString().slice(0, 5));
              }}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !selectedFile || !fileTitle.trim()}>
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
    </div>
  );
};

export default Reports;
