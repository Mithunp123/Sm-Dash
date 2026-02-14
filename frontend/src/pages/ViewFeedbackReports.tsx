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
import { Badge } from '@/components/ui/badge';
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
      const detailsData = responses.map(r => {
        const question = questions.find(q => q.id === r.question_id);
        return {
          'Student Name': r.student_name,
          'Email': r.student_email,
          'Event': question?.event_title || 'General Feedback',
          'Question': r.question_text || question?.question_text,
          'Rating': r.rating || 'N/A',
          'Feedback': r.feedback_text || '',
          'Date': new Date(r.created_at).toLocaleDateString(),
        };
      });

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
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground">Feedback Reports</h1>
                <p className="text-xs sm:text-sm md:text-base font-medium text-muted-foreground opacity-70 border-l-4 border-primary/30 pl-3 mt-1">Audit student satisfaction and event quality</p>
              </div>
            </div>
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading feedback data...</p>
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
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground">Feedback Reports</h1>
              <p className="text-xs sm:text-sm md:text-base font-medium text-muted-foreground opacity-70 border-l-4 border-primary/30 pl-3 mt-1">Audit student satisfaction and event quality</p>
            </div>
            <Button
              onClick={downloadAsExcel}
              disabled={questions.length === 0 || responses.length === 0}
              className="gap-2 h-11 px-6 rounded-2xl shadow-lg shadow-primary/20 bg-primary font-bold w-full sm:w-auto"
            >
              <Download className="w-4 h-4" />
              Download Report
            </Button>
          </div>

          {questions.length === 0 ? (
            <Card className="p-12 text-center gradient-card">
              <p className="text-muted-foreground">No feedback questions created yet</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {questions.map(question => {
                const questionStats = generateStats(question.id);
                const hasResponses = (questionStats?.totalResponses || 0) > 0;

                return (
                  <Card key={question.id} className="group relative overflow-hidden rounded-3xl border-border/40 bg-card/60 backdrop-blur-md shadow-md hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300">
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row gap-6 items-start">
                        <div className="flex-1 space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="text-xl font-bold text-foreground">
                              {question.question_text}
                            </h3>
                            <Badge className="shrink-0 font-bold text-xs uppercase tracking-widest px-2 py-0.5 border-none bg-primary/10 text-primary">
                              {question.question_type === 'rating' ? 'Rating' : 'Text'}
                            </Badge>
                          </div>

                          {question.event_title ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-bold text-xs uppercase tracking-widest border-primary/30 text-primary/70">
                                📅 {question.event_title}
                              </Badge>
                              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-50">{new Date(question.event_date!).toLocaleDateString()}</span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="font-bold text-xs uppercase tracking-widest border-muted-foreground/30 text-muted-foreground/70">
                              📋 General Feedback
                            </Badge>
                          )}
                        </div>

                        <div className="w-full md:w-auto flex flex-col items-end gap-3 min-w-[200px]">
                          {hasResponses ? (
                            <div className="text-right">
                              <div className="text-3xl font-bold text-foreground">
                                {questionStats?.totalResponses}
                                <span className="text-xs font-medium text-muted-foreground ml-1">voters</span>
                              </div>
                              {question.question_type === 'rating' && (
                                <div className="text-xs font-bold text-amber-500 flex items-center justify-end gap-1">
                                  {questionStats?.averageRating.toFixed(1)} <span className="text-amber-400">★</span> Avg Score
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-xs font-bold uppercase tracking-widest italic py-2">No data recorded</div>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(question.id)}
                            disabled={!hasResponses}
                            className="w-full md:w-auto h-9 rounded-xl font-bold text-xs uppercase tracking-widest border-2"
                          >
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Analyze
                          </Button>
                        </div>
                      </div>

                      {/* Mini Viz for Rating */}
                      {hasResponses && question.question_type === 'rating' && (
                        <div className="mt-6 pt-6 border-t border-border/50">
                          <div className="flex items-end gap-1 h-12">
                            {[1, 2, 3, 4, 5].map(rating => {
                              const count = questionStats?.ratingDistribution[rating] || 0;
                              const total = questionStats?.totalResponses || 1;
                              const percentage = (count / total) * 100;

                              // Color gradient from Red (1) to Green (5)
                              const colorClass =
                                rating === 1 ? 'bg-red-500' :
                                  rating === 2 ? 'bg-orange-500' :
                                    rating === 3 ? 'bg-yellow-500' :
                                      rating === 4 ? 'bg-lime-500' : 'bg-green-500';

                              return (
                                <div key={rating} className="flex-1 flex flex-col justify-end gap-1 group/bar cursor-default">
                                  <div className="w-full bg-muted/30 rounded-t-sm relative h-full">
                                    <div
                                      className={`absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-500 ${colorClass} opacity-80 group-hover/bar:opacity-100`}
                                      style={{ height: `${percentage}%` }}
                                    />
                                  </div>
                                  <div className="text-center">
                                    <div className="text-xs text-muted-foreground font-medium">{rating}★</div>
                                  </div>
                                  {/* Tooltip-ish */}
                                  <div className="hidden group-hover/bar:block absolute -mt-8 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-sm z-10 whitespace-nowrap">
                                    {count} votes ({percentage.toFixed(0)}%)
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
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
                    <h3 className="font-semibold text-foreground mb-3">Question Summary</h3>
                    <p className="text-foreground mb-4">{stats.question.question_text}</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Responses</p>
                        <p className="text-2xl font-bold text-foreground">
                          {stats.totalResponses}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Average Rating</p>
                        <p className="text-2xl font-bold text-foreground">
                          {stats.averageRating.toFixed(2)}/5
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Question Type</p>
                        <p className="text-lg font-semibold text-foreground">
                          {stats.question.question_type === 'rating' ? '⭐ Rating' : '📝 Text'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Rating Distribution */}
                  {stats.question.question_type === 'rating' && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-4">Rating Distribution</h3>
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
                              <div className="flex-1 bg-muted h-6 rounded overflow-hidden">
                                <div
                                  className={`h-full flex items-center justify-end pr-2 text-foreground text-xs font-semibold transition-all ${rating >= 4
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
                              <span className="w-12 text-right text-sm text-muted-foreground">
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
                    <h3 className="font-semibold text-foreground mb-4">Student Responses</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {stats.responses.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No responses yet</p>
                      ) : (
                        stats.responses.map(response => (
                          <div
                            key={response.id}
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-foreground">
                                  {response.student_name}
                                </p>
                                <p className="text-sm text-muted-foreground">{response.student_email}</p>
                              </div>
                              {response.rating && (
                                <span className="text-lg font-semibold text-yellow-500">
                                  {response.rating}⭐
                                </span>
                              )}
                            </div>
                            {response.feedback_text && (
                              <p className="text-sm text-foreground mt-2 italic">
                                "{response.feedback_text}"
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
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
