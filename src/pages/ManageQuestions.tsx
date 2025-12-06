import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DeveloperCredit from '@/components/DeveloperCredit';
import { useNavigate } from 'react-router-dom';
import { auth } from '@/lib/auth';

interface FeedbackQuestion {
  id: number;
  question_text: string;
  question_type: string;
  event_id: number | null;
  is_enabled?: number;
  event_title: string | null;
  event_date: string | null;
  created_at: string;
  updated_at: string;
}

interface Meeting {
  id: number;
  title: string;
  date: string;
}

export default function ManageQuestions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ question_text: '', question_type: 'rating', event_id: '', is_enabled: true });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    // Check authentication and role
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    const userRole = auth.getRole();
    if (userRole !== 'admin' && userRole !== 'office_bearer') {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to manage feedback questions',
        variant: 'destructive',
      });
      navigate(userRole === 'student' ? '/student' : '/');
      return;
    }

    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [questionsRes, meetingsRes] = await Promise.all([
        api.getFeedbackQuestions(),
        api.getMeetings(),
      ]);

      if (questionsRes.success) {
        setQuestions(questionsRes.questions || []);
      }
      if (meetingsRes.success) {
        setMeetings(meetingsRes.meetings || []);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (question?: FeedbackQuestion) => {
    if (question) {
      setEditingId(question.id);
      setFormData({
        question_text: question.question_text,
        question_type: question.question_type,
        event_id: question.event_id?.toString() || '',
        is_enabled: question.is_enabled === 0 ? false : true,
      });
    } else {
      setEditingId(null);
      setFormData({ question_text: '', question_type: 'rating', event_id: '', is_enabled: true });
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.question_text.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Question text is required',
          variant: 'destructive',
        });
        return;
      }

  const event_id = formData.event_id ? parseInt(formData.event_id) : undefined;
  const is_enabled = !!formData.is_enabled;

      let response;
      if (editingId) {
        response = await api.updateFeedbackQuestion(
          editingId,
          formData.question_text,
          formData.question_type,
          event_id,
          is_enabled
        );
      } else {
        response = await api.createFeedbackQuestion(
          formData.question_text,
          formData.question_type,
          event_id,
          is_enabled
        );
      }

      if (response.success) {
        toast({
          title: 'Success',
          description: editingId ? 'Question updated' : 'Question created',
        });
        setIsOpen(false);
        loadData();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save question',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const response = await api.deleteFeedbackQuestion(deleteId);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Question deleted',
        });
        loadData();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete question',
        variant: 'destructive',
      });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <DeveloperCredit />
      
      <div className="flex flex-1">
        <main className="flex-1 p-4 md:p-8 bg-background">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2">Feedback Questions</h1>
                <p className="text-muted-foreground">Create and manage feedback questions for events</p>
              </div>
              <Button
                onClick={() => handleOpen()}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                New Question
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading questions...</p>
              </div>
            ) : questions.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-gray-600 mb-4">No feedback questions yet</p>
                <Button
                  onClick={() => handleOpen()}
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Create First Question
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {questions.map(question => (
                  <Card key={question.id} className="p-6 gradient-card border-border/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800">
                          {question.question_text}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 flex-wrap">
                          <span className="bg-gray-100 px-2 py-1 rounded">
                            {question.question_type === 'rating' ? '⭐ Rating Scale' : '📝 Text'}
                          </span>
                          {question.event_title && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              📅 {question.event_title}
                            </span>
                          )}
                          {!question.event_title && (
                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                              📋 General Feedback
                            </span>
                          )}
                          <span>Created: {new Date(question.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await api.toggleFeedbackQuestion(question.id);
                              loadData();
                            } catch (e: any) {
                              toast({ title: 'Error', description: e.message || 'Failed to toggle question', variant: 'destructive' });
                            }
                          }}
                          className="gap-2"
                        >
                          {question.is_enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpen(question)}
                          className="gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteId(question.id)}
                          className="gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? 'Edit Question' : 'Create New Question'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingId ? 'Update the feedback question' : 'Create a new feedback question'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Text *
                    </label>
                    <Textarea
                      value={formData.question_text}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          question_text: e.target.value,
                        }))
                      }
                      placeholder="Enter the feedback question..."
                      className="min-h-[100px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Type
                    </label>
                    <select
                      value={formData.question_type}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          question_type: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                    >
                      <option value="rating">⭐ Rating Scale (1-5 stars)</option>
                      <option value="text">📝 Text Response</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Event/Meeting (Optional)
                    </label>
                    <select
                      value={formData.event_id}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          event_id: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                    >
                      <option value="">-- General Feedback (All Students) --</option>
                      {meetings.map(meeting => (
                        <option key={meeting.id} value={meeting.id.toString()}>
                          {meeting.title} ({new Date(meeting.date).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      If you select an event, only students who attended will see this question
                    </p>
                  </div>
                  <div>
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={!!formData.is_enabled}
                        onChange={e => setFormData(prev => ({ ...prev, is_enabled: e.target.checked }))}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Enabled</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">If disabled, students will still be able to view previously submitted responses (admins only) but won't be able to submit new responses for this question.</p>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      {editingId ? 'Update' : 'Create'} Question
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
              <AlertDialogContent>
                <AlertDialogTitle>Delete Question</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this question? This action cannot be undone.
                </AlertDialogDescription>
                <div className="flex gap-3 justify-end">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
