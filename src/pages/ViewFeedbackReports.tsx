import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Eye, BarChart3, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import DeveloperCredit from '@/components/DeveloperCredit';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '@/components/BackButton';
import { auth } from '@/lib/auth';

interface FeedbackQuestion {
  id: number;
  question_text: string;
  question_type: string;
  event_id: number | null;
  event_title: string | null;
  event_date: string | null;
  created_at: string;
}

interface FeedbackResponse {
  id: number;
  question_id: number;
  user_id: number;
  rating: number;
  feedback_text: string;
  created_at: string;
  student_name: string;
  student_email: string;
  question_text: string;
  question_type: string;
}

interface QuestionStats {
  question: FeedbackQuestion;
  totalResponses: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  responses: FeedbackResponse[];
}

export default function ViewFeedbackReports() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);
  const [stats, setStats] = useState<QuestionStats | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    // Check authentication and role
    if (!auth.isAuthenticated()) {
      navigate("/login");
      return;
    }

    const userRole = auth.getRole();
    if (userRole !== 'admin') {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to view feedback reports',
        variant: 'destructive',
      });
      navigate(userRole === 'office_bearer' ? '/office-bearer' : (userRole === 'student' ? '/student' : '/'));
      return;
    }

    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [questionsRes, responsesRes] = await Promise.all([
        api.getFeedbackQuestions(),
        api.getFeedbackResponses(),
      ]);

      if (questionsRes.success) {
        setQuestions(questionsRes.questions || []);
      }
      if (responsesRes.success) {
        setResponses(responsesRes.responses || []);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load feedback data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateStats = (questionId: number) => {
    const question = questions.find(q => q.id === questionId);
    const questionResponses = responses.filter(r => r.question_id === questionId);

    if (!question) return null;

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    questionResponses.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDistribution[r.rating]++;
        totalRating += r.rating;
      }
    });

    return {
      question,
      totalResponses: questionResponses.length,
      averageRating: questionResponses.length > 0 ? totalRating / questionResponses.length : 0,
      ratingDistribution,
      responses: questionResponses,
    };
  };

  const handleViewDetails = (questionId: number) => {
    const questionStats = generateStats(questionId);
    setStats(questionStats);
    setSelectedQuestion(questionId);
    setDetailsOpen(true);
  };

  const downloadAsExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = questions.map(q => {
        const questionStats = generateStats(q.id);
        return {
          'Question': q.question_text,
          'Type': q.question_type,
          'Total Responses': questionStats?.totalResponses || 0,
          'Average Rating': questionStats?.averageRating.toFixed(2) || 'N/A',
          '5-Star': questionStats?.ratingDistribution[5] || 0,
          '4-Star': questionStats?.ratingDistribution[4] || 0,
          '3-Star': questionStats?.ratingDistribution[3] || 0,
          '2-Star': questionStats?.ratingDistribution[2] || 0,
          '1-Star': questionStats?.ratingDistribution[1] || 0,
        };
      });

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Detailed responses sheet
      const detailsData = responses.map(r => ({
        'Student': r.student_name,
        'Email': r.student_email,
        'Question': r.question_text,
        'Rating': r.rating || 'N/A',
        'Feedback': r.feedback_text || '',
        'Date': new Date(r.created_at).toLocaleDateString(),
      }));

      const detailsSheet = XLSX.utils.json_to_sheet(detailsData);
      XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Detailed Responses');

      // Set column widths
      const maxWidth = 50;
      summarySheet['!cols'] = Array(9).fill({ wch: 15 });
      detailsSheet['!cols'] = Array(6).fill({ wch: maxWidth });

      XLSX.writeFile(workbook, `feedback-report-${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: 'Success',
        description: 'Report downloaded successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to download report',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-transparent">
        <DeveloperCredit />
        <main className="flex-1 p-2 md:p-4 bg-transparent w-full">
          <div className="w-full">
            {/* Page Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-foreground mb-1">Feedback Reports</h1>
                <p className="text-sm text-muted-foreground">View and analyze student feedback responses</p>
              </div>
            </div>
            <div className="text-center py-12">
              <p className="text-gray-600">Loading feedback data...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <DeveloperCredit />

      <main className="flex-1 p-2 md:p-4 bg-background w-full">
        <div className="w-full">
          <div className="mb-4">
            <BackButton to="/admin" />
          </div>
          {/* Page Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-1">Feedback Reports</h1>
              <p className="text-sm text-muted-foreground">View and analyze student feedback responses</p>
            </div>
            <Button
              onClick={downloadAsExcel}
              disabled={questions.length === 0 || responses.length === 0}
              className="gap-2 bg-white text-orange-600 hover:bg-orange-50"
            >
              <Download className="w-4 h-4" />
              Download Report
            </Button>
          </div>

          {questions.length === 0 ? (
            <Card className="p-12 text-center gradient-card">
              <p className="text-gray-600">No feedback questions created yet</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {questions.map(question => {
                const questionStats = generateStats(question.id);
                const hasResponses = (questionStats?.totalResponses || 0) > 0;

                return (
                  <Card key={question.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800">
                          {question.question_text}
                        </h3>
                        {question.event_title && (
                          <p className="text-sm text-blue-600 font-medium mt-1">
                            📅 Event: {question.event_title} ({new Date(question.event_date).toLocaleDateString()})
                          </p>
                        )}
                        {!question.event_title && (
                          <p className="text-sm text-purple-600 font-medium mt-1">
                            📋 General Feedback
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-3">
                          <span className="text-sm text-gray-600">
                            <span className="font-semibold text-lg">
                              {questionStats?.totalResponses || 0}
                            </span>{' '}
                            responses
                          </span>
                          {hasResponses && (
                            <>
                              <span className="text-sm text-gray-600">
                                Average Rating:{' '}
                                <span className="font-semibold">
                                  {questionStats?.averageRating.toFixed(1)}/5 ⭐
                                </span>
                              </span>
                              {/* Rating distribution bars */}
                              <div className="flex gap-1">
                                {[5, 4, 3, 2, 1].map(rating => {
                                  const count = questionStats?.ratingDistribution[rating] || 0;
                                  const percentage =
                                    (questionStats?.totalResponses || 0) > 0
                                      ? (count / (questionStats?.totalResponses || 1)) * 100
                                      : 0;
                                  return (
                                    <div
                                      key={rating}
                                      className="flex flex-col items-center"
                                      title={`${rating} stars: ${count} (${percentage.toFixed(0)}%)`}
                                    >
                                      <div className="w-6 bg-gray-200 rounded overflow-hidden h-12">
                                        <div
                                          className={`w-full transition-all ${rating >= 4
                                            ? 'bg-green-500'
                                            : rating === 3
                                              ? 'bg-yellow-500'
                                              : 'bg-red-500'
                                            }`}
                                          style={{ height: `${percentage || 5}%` }}
                                        />
                                      </div>
                                      <span className="text-xs mt-1 font-semibold">{rating}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(question.id)}
                        disabled={!hasResponses}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Details Dialog */}
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Feedback Details
                </DialogTitle>
              </DialogHeader>

              {stats && (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-3">Question Summary</h3>
                    <p className="text-blue-800 mb-4">{stats.question.question_text}</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-blue-600">Total Responses</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {stats.totalResponses}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-blue-600">Average Rating</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {stats.averageRating.toFixed(2)}/5
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-blue-600">Question Type</p>
                        <p className="text-lg font-semibold text-blue-900">
                          {stats.question.question_type === 'rating' ? '⭐ Rating' : '📝 Text'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Rating Distribution */}
                  {stats.question.question_type === 'rating' && (
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-4">Rating Distribution</h3>
                      <div className="space-y-3">
                        {[5, 4, 3, 2, 1].map(rating => {
                          const count = stats.ratingDistribution[rating] || 0;
                          const percentage =
                            stats.totalResponses > 0
                              ? (count / stats.totalResponses) * 100
                              : 0;
                          const labels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
                          return (
                            <div key={rating} className="flex items-center gap-3">
                              <span className="w-20 text-sm font-medium">
                                {labels[rating - 1]} ({rating}⭐)
                              </span>
                              <div className="flex-1 bg-gray-200 h-6 rounded overflow-hidden">
                                <div
                                  className={`h-full flex items-center justify-end pr-2 text-white text-xs font-semibold transition-all ${rating >= 4
                                    ? 'bg-green-500'
                                    : rating === 3
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                    }`}
                                  style={{ width: `${percentage}%` }}
                                >
                                  {percentage > 5 && `${percentage.toFixed(0)}%`}
                                </div>
                              </div>
                              <span className="w-12 text-right text-sm text-gray-600">
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Individual Responses */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-4">Student Responses</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {stats.responses.length === 0 ? (
                        <p className="text-gray-600 text-center py-4">No responses yet</p>
                      ) : (
                        stats.responses.map(response => (
                          <div
                            key={response.id}
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {response.student_name}
                                </p>
                                <p className="text-sm text-gray-600">{response.student_email}</p>
                              </div>
                              {response.rating && (
                                <span className="text-lg font-semibold text-yellow-500">
                                  {response.rating}⭐
                                </span>
                              )}
                            </div>
                            {response.feedback_text && (
                              <p className="text-sm text-gray-700 mt-2 italic">
                                "{response.feedback_text}"
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(response.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
