import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Download, Edit, Save, RotateCw, ZoomIn, ZoomOut, Search } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface PDFViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: {
    id: number;
    title?: string;
    original_name?: string;
    url?: string;
    resource_type?: string;
    description?: string;
  } | null;
  onUpdate?: () => void;
  canEdit?: boolean;
}

const PDFViewer = ({ open, onOpenChange, resource, onUpdate, canEdit = false }: PDFViewerProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    resource_type: '',
  });
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);

  if (!resource) return null;

  const handleEdit = () => {
    setEditData({
      title: resource.title || resource.original_name || '',
      description: resource.description || '',
      resource_type: resource.resource_type || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const response = await api.put(`/resources/${resource.id}`, editData);
      if (response.success) {
        toast.success("Resource updated successfully!");
        setIsEditing(false);
        if (onUpdate) onUpdate();
      } else {
        toast.error("Failed to update resource");
      }
    } catch (error: any) {
      console.error("Error updating resource:", error);
      toast.error("Failed to update resource: " + (error.message || error));
    }
  };

  const handleDownload = () => {
    if (resource.url) {
      const link = document.createElement('a');
      link.href = resource.url;
      link.download = resource.original_name || resource.title || 'resource.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col p-0 [&>button]:hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold truncate pr-4">
              {isEditing ? 'Edit Resource' : (resource.title || resource.original_name || 'PDF Viewer')}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEdit}
                      className="gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </Button>
                  )}
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsEditing(false);
                  onOpenChange(false);
                }}
                className="h-9 w-9"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isEditing ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  placeholder="Resource title"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editData.resource_type}
                  onValueChange={(value) => setEditData({ ...editData, resource_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Academic">Academic</SelectItem>
                    <SelectItem value="Examination">Examination</SelectItem>
                    <SelectItem value="Research">Research</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="FPR">FPR</SelectItem>
                    <SelectItem value="Miscellaneous">Miscellaneous</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder="Resource description (optional)"
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* PDF Controls */}
            <div className="px-6 py-3 border-b bg-gray-50 dark:bg-gray-900 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {page} / 1
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  • {zoom}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  className="gap-1"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  className="gap-1"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom(100)}
                  className="gap-1"
                >
                  Fit to Page
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRotate}
                  className="gap-1"
                >
                  <RotateCw className="w-4 h-4" />
                  Rotate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-1"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-800 p-4">
              <div className="flex justify-center items-start min-h-full">
                <div
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s',
                  }}
                  className="bg-white dark:bg-gray-900 shadow-lg"
                >
                  <iframe
                    src={resource.url}
                    className="w-full"
                    style={{
                      width: '800px',
                      height: '1000px',
                      border: 'none',
                    }}
                    title={resource.title || resource.original_name || 'PDF'}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PDFViewer;

