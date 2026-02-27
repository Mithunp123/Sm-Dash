import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const OfficeBearerMentees = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mentees, setMentees] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.isAuthenticated()) return navigate('/login');
    const u = auth.getUser();
    if (!u || (u.role !== 'office_bearer' && u.role !== 'admin')) {
      toast.error('Unauthorized');
      navigate('/');
      return;
    }
    loadMentees();
  }, []);

  const loadMentees = async () => {
    try {
      setLoading(true);
      const projectsRes = await api.getProjects();
      const projects = projectsRes.success ? projectsRes.projects || [] : [];

      const all: any[] = [];
      for (const p of projects) {
        try {
          const r = await api.getProjectMentees(p.id);
          if (r.success && r.mentees) {
            r.mentees.forEach((m: any) => all.push({ ...m, project_title: p.title }));
          }
        } catch (e) {
          // ignore per-project failures
        }
      }

      setMentees(all);
    } catch (error: any) {
      console.error('Load mentees error', error);
      toast.error('Failed to load mentees');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Mentees</h1>
            <p className="text-muted-foreground">Mentees across projects you manage</p>
          </div>
          <div>
            <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
          </div>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : mentees.length === 0 ? (
          <div>No mentees found</div>
        ) : (
          <div className="space-y-4">
            {mentees.map((m: any) => (
              <Card key={`${m.id}-${m.project_id}`}>
                <CardHeader>
                  <CardTitle>{m.mentee_name}</CardTitle>
                  <CardDescription>{m.project_title} • {m.mentee_school || ''}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div><strong>Phone:</strong> {m.mentee_phone || '—'}</div>
                    <div><strong>Year:</strong> {m.mentee_year || '—'}</div>
                    <div><strong>Status:</strong> {m.mentee_status || '—'}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OfficeBearerMentees;
