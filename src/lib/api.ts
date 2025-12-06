const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: any;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Use sessionStorage so auth lasts only for the current browser session/tab
    this.token = sessionStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      sessionStorage.setItem('auth_token', token);
    } else {
      sessionStorage.removeItem('auth_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Refresh token from sessionStorage in case it was updated elsewhere
    const storedToken = sessionStorage.getItem('auth_token');
    if (storedToken && !this.token) {
      this.token = storedToken;
    }

    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      let data: any;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.ok) {
        // Handle different error status codes
        if (response.status === 401) {
          // For login endpoint, don't clear token on failure
          if (endpoint !== '/auth/login') {
            this.setToken(null);
          }
          throw new Error(data.message || 'Invalid email or password');
        } else if (response.status === 403) {
          // Return permission denied as a successful response with success: false
          // This allows the app to continue without throwing errors
          return {
            success: false,
            message: data.message || 'Access forbidden - insufficient permissions',
            data: null
          };
        } else if (response.status === 404) {
          throw new Error(data.message || 'Resource not found');
        } else if (response.status >= 500) {
          throw new Error(data.message || 'Server error. Please try again later.');
        } else {
          throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
        }
      }

      return data;
    } catch (error: any) {
      console.error('API request error:', error);
      
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Cannot connect to server. Please make sure the backend is running on http://localhost:3000');
      }
      
      // Re-throw with better message
      if (error.message) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  }

  // Generic GET method
  async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // Generic POST method
  async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Generic PUT method
  async put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Generic DELETE method
  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.success && response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async forgotPassword(email: string) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    });
  }

  // User endpoints
  async getUsers() {
    // If no auth token is stored, avoid calling admin-protected endpoints which cause 403
    if (!this.token) {
      console.warn('Skipping /users call: no auth token present');
      return { success: true, users: [] };
    }
    // Avoid calling the admin-only /users endpoint for non-admin clients.
    // Check localStorage for the current user's role (no direct import to avoid circular deps).
    try {
      const userStr = sessionStorage.getItem('auth_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.role && user.role === 'admin') {
          const response = await this.request('/users');
          if (!response.success && response.message?.includes('forbidden')) {
            return { success: true, users: [] };
          }
          return response;
        }

        // If caller is office_bearer, call scoped students endpoint instead
        if (user && user.role && user.role === 'office_bearer') {
          const response = await this.request('/users/students');
          if (!response.success && response.message?.includes('forbidden')) {
            return { success: true, students: [] };
          }
          // Normalize to 'users' key for backward compatibility
          if (response.success && response.students) {
            return { success: true, users: response.students } as any;
          }
          return { success: true, users: [] } as any;
        }
      }
    } catch (err) {
      // If parsing fails, fall back to safe behavior below
      console.warn('Could not read auth_user from localStorage before getUsers', err);
    }

    // Default for unauthenticated or other roles: return empty users list instead of calling admin endpoint
    return { success: true, users: [] };
  }

  async getPermissionUsers() {
    if (!this.token) {
      console.warn('Skipping /permissions/users call: no auth token present');
      return { success: true, users: [] };
    }
    const response = await this.request('/permissions/users');
    if (!response.success && response.message?.includes('forbidden')) {
      return { success: true, users: [] };
    }
    return response;
  }

  // Get students scoped to caller: admins get all students, office_bearer gets students in their dept
  async getStudentsScoped() {
    // If no auth token, avoid calling protected endpoint and return empty
    if (!this.token) {
      console.warn('Skipping /users/students call: no auth token present');
      return { success: true, students: [] };
    }
    try {
      const userStr = sessionStorage.getItem('auth_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (!user || !user.role || (user.role !== 'admin' && user.role !== 'office_bearer')) {
          // Roles other than admin/office_bearer are not allowed to call this endpoint.
          return { success: true, students: [] };
        }
      }
    } catch (err) {
      console.warn('Could not read auth_user from localStorage before getStudentsScoped', err);
    }

    const response = await this.request('/users/students');
    // Handle permission denied by returning empty array
    if (!response.success && response.message?.includes('forbidden')) {
      return { success: true, students: [] };
    }
    return response;
  }

  async getUser(id: number) {
    return this.request(`/users/${id}`);
  }
  async getProfile(userId: number) {
    return this.request(`/users/${userId}/profile`);
  }
  async updateProfile(userId: number, profileData: any) {
    return this.request(`/users/${userId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }
  async addUser(userData: any) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }
  async resetUserPassword(userId: number, newPassword?: string) {
    return this.request('/users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword }),
    });
  }

  // Meeting endpoints
  async getMeetings() {
    const response = await this.request('/meetings');
    // Handle permission denied by returning empty array
    if (!response.success && response.message?.includes('forbidden')) {
      return { success: true, meetings: [] };
    }
    return response;
  }

  async getMeeting(id: number) {
    return this.request(`/meetings/${id}`);
  }

  async createMeeting(meetingData: any) {
    return this.request('/meetings', {
      method: 'POST',
      body: JSON.stringify(meetingData),
    });
  }

  // Attendance endpoints
  async getAttendance(params?: { meetingId?: number; userId?: number }) {
    const query = new URLSearchParams();
    if (params?.meetingId) query.append('meetingId', params.meetingId.toString());
    if (params?.userId) query.append('userId', params.userId.toString());
    const queryString = query.toString();
    const response = await this.request(`/attendance${queryString ? `?${queryString}` : ''}`);
    // Handle permission denied by returning empty array
    if (!response.success && response.message?.includes('forbidden')) {
      return { success: true, attendance: [] };
    }
    return response;
  }

  async markAttendance(attendanceData: any) {
    return this.request('/attendance', {
      method: 'POST',
      body: JSON.stringify(attendanceData),
    });
  }

  async updateAttendance(id: number, attendanceData: any) {
    return this.request(`/attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(attendanceData),
    });
  }

  async deleteAttendance(id: number) {
    return this.request(`/attendance/${id}`, {
      method: 'DELETE',
    });
  }

  async getProjectAttendance(projectId: number, date?: string) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request(`/attendance/project/${projectId}/records${query}`);
  }

  async markProjectAttendance(projectId: number, data: { userId: number; attendance_date: string; status: string; notes?: string }) {
    return this.request(`/attendance/project/${projectId}/mark`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProjectAttendance(recordId: number, data: { status?: string; notes?: string; attendance_date?: string }) {
    return this.request(`/attendance/project/records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProjectAttendance(recordId: number) {
    return this.request(`/attendance/project/records/${recordId}`, {
      method: 'DELETE',
    });
  }

  // Event attendance endpoints
  async getStudentEvents(userId: number) {
    return this.request(`/attendance/student/events/${userId}`);
  }

  async getEventAttendance(eventId: number, userId: number) {
    return this.request(`/attendance/event/${eventId}/user/${userId}`);
  }

  async markEventAttendance(eventId: number, data: { userId: number; status: string; notes?: string }) {
    return this.request(`/attendance/event/${eventId}/mark`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Permissions endpoints
  async getPermissions(userId?: number) {
    if (userId) {
      return this.request(`/permissions/user/${userId}`);
    }
    return this.request('/permissions');
  }

  // Profile field settings
  async getProfileFieldSettings() {
    return this.request('/settings/profile-fields');
  }

  async updateProfileFieldSettings(fields: any[]) {
    return this.request('/settings/profile-fields', {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    });
  }

  async addProfileField(label: string, field_type: string = 'text') {
    return this.request('/settings/profile-fields', {
      method: 'POST',
      body: JSON.stringify({ label, field_type }),
    });
  }

  async deleteProfileField(field_name: string) {
    return this.request(`/settings/profile-fields/${field_name}`, {
      method: 'DELETE',
    });
  }

  // Role-level profile field permissions
  async getRoleProfileFieldSettings() {
    return this.request('/settings/role-profile-fields');
  }

  async updateRoleProfileFieldSettings(rows: any[]) {
    return this.request('/settings/role-profile-fields', {
      method: 'PUT',
      body: JSON.stringify({ rows }),
    });
  }

  async updatePermissions(userId: number, permissions: any) {
    return this.request(`/permissions/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(permissions),
    });
  }

  // Project endpoints
  async getProjects() {
    const response = await this.request('/projects');
    // Handle permission denied by returning empty array
    if (!response.success && response.message?.includes('forbidden')) {
      return { success: true, projects: [] };
    }
    return response;
  }

  async getUserProjects(userId: number) {
    return this.request(`/users/${userId}/projects`);
  }

  async getProject(id: number) {
    return this.request(`/projects/${id}`);
  }

  async createProject(projectData: any) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  async updateProject(projectId: number, projectData: any) {
    return this.request(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    });
  }

  async addProjectMember(projectId: number, userId: number) {
    return this.request(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async getProjectStudents(projectId: number) {
    return this.request(`/projects/${projectId}/students`);
  }

  // Bill endpoints
  async getBills() {
    return this.request('/bills');
  }

  async createBill(billData: any) {
    return this.request('/bills', {
      method: 'POST',
      body: JSON.stringify(billData),
    });
  }

  async updateBill(billId: number, billData: any) {
    return this.request(`/bills/${billId}`, {
      method: 'PUT',
      body: JSON.stringify(billData),
    });
  }

  async deleteBill(billId: number) {
    return this.request(`/bills/${billId}`, {
      method: 'DELETE',
    });
  }

  // Time endpoints
  async getTimeAllotments(params?: { userId?: number; projectId?: number }) {
    const query = new URLSearchParams();
    if (params?.userId) query.append('userId', params.userId.toString());
    if (params?.projectId) query.append('projectId', params.projectId.toString());
    const queryString = query.toString();
    return this.request(`/time/allotments${queryString ? `?${queryString}` : ''}`);
  }

  async getTimeRequests(params?: { userId?: number; status?: string }) {
    const query = new URLSearchParams();
    if (params?.userId) query.append('userId', params.userId.toString());
    if (params?.status) query.append('status', params.status);
    const queryString = query.toString();
    return this.request(`/time/requests${queryString ? `?${queryString}` : ''}`);
  }

  // Permission requests
  async requestPermission(permissionKey: string, message?: string) {
    return this.request('/permission-requests', {
      method: 'POST',
      body: JSON.stringify({ permission_key: permissionKey, message: message || '' })
    });
  }

  async getPermissionRequests() {
    return this.request('/permission-requests');
  }

  async processPermissionRequest(id: number, status: 'approved' | 'rejected') {
    return this.request(`/permission-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // Student profile endpoints
  async getStudentProfile(userId: number) {
    return this.request(`/users/${userId}/profile`);
  }

  async updateStudentProfile(userId: number, profileData: any) {
    return this.request(`/users/${userId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async assignStudentToProject(userId: number, projectId: number) {
    return this.request(`/users/${userId}/assign-project`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }
  
  async unassignStudentFromProject(userId: number, projectId: number) {
    return this.request(`/users/${userId}/unassign-project/${projectId}`, {
      method: 'DELETE'
    });
  }

  // Alumni endpoints
  async getAlumni() {
    const response = await this.request('/alumni');
    // Handle permission denied by returning empty array
    if (!response.success && response.message?.includes('forbidden')) {
      return { success: true, alumni: [] };
    }
    return response;
  }

  async bulkAssignStudentsToProject(projectId: number, studentIds: number[]) {
    return this.request(`/projects/${projectId}/bulk-assign-students`, {
      method: 'POST',
      body: JSON.stringify({ studentIds }),
    });
  }

  // Feedback endpoints
  async getFeedbackQuestions() {
    return this.request('/feedback/questions');
  }

  async createFeedbackQuestion(question_text: string, question_type: string = 'rating', event_id?: number, is_enabled: boolean = true) {
    return this.request('/feedback/questions', {
      method: 'POST',
      body: JSON.stringify({ question_text, question_type, event_id: event_id || null, is_enabled }),
    });
  }

  async updateFeedbackQuestion(questionId: number, question_text: string, question_type: string, event_id?: number, is_enabled?: boolean) {
    return this.request(`/feedback/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify({ question_text, question_type, event_id: event_id || null, is_enabled }),
    });
  }

  async toggleFeedbackQuestion(questionId: number) {
    return this.request(`/feedback/questions/${questionId}/toggle`, {
      method: 'PATCH',
    });
  }

  async deleteFeedbackQuestion(questionId: number) {
    return this.request(`/feedback/questions/${questionId}`, {
      method: 'DELETE',
    });
  }

  async submitFeedbackResponse(question_id: number, rating: number, feedback_text?: string) {
    return this.request('/feedback/responses', {
      method: 'POST',
      body: JSON.stringify({ question_id, rating, feedback_text: feedback_text || null }),
    });
  }

  async getFeedbackResponses() {
    return this.request('/feedback/responses');
  }

  async getFeedbackResponsesByQuestion(questionId: number) {
    return this.request(`/feedback/responses/question/${questionId}`);
  }

  // Events endpoints
  // Accept optional year and month filters. month should be '1'..'12' or '01'..'12'.
  async getEvents(year?: string, month?: string) {
    let url = '/events';
    const params: string[] = [];
    if (year) params.push(`year=${encodeURIComponent(year)}`);
    if (month) params.push(`month=${encodeURIComponent(month)}`);
    if (params.length) url = `/events?${params.join('&')}`;
    return this.request(url);
  }

  async getUserEvents(userId: number) {
    return this.request(`/events/user/${userId}`);
  }

  async getEventById(eventId: number) {
    return this.request(`/events/${eventId}`);
  }

  async createEvent(title: string, date: string, year: string, description?: string, is_special_day?: boolean) {
    return this.request('/events', {
      method: 'POST',
      body: JSON.stringify({ title, description, date, year, is_special_day }),
    });
  }

  async updateEvent(eventId: number, title: string, date: string, year: string, description?: string, is_special_day?: boolean) {
    return this.request(`/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify({ title, description, date, year, is_special_day }),
    });
  }

  async deleteEvent(eventId: number) {
    return this.request(`/events/${eventId}`, {
      method: 'DELETE',
    });
  }

  async markEventOD(eventId: number, userId: number, status: 'od' | 'absent' | 'permission') {
    return this.request(`/events/${eventId}/od`, {
      method: 'POST',
      body: JSON.stringify({ userId, status }),
    });
  }

  async removeEventOD(eventId: number, userId: number) {
    return this.request(`/events/${eventId}/od/${userId}`, {
      method: 'DELETE',
    });
  }

  async getEventMembers(eventId: number) {
    return this.request(`/events/${eventId}/members`);
  }

  async addEventMembers(eventId: number, userIds: number[]) {
    return this.request(`/events/${eventId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
  }

  async addEventMembersByEmails(eventId: number, emails: string[]) {
    return this.request(`/events/${eventId}/members/by-email`, {
      method: 'POST',
      body: JSON.stringify({ emails }),
    });
  }

  async removeEventMember(eventId: number, userId: number) {
    return this.request(`/events/${eventId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  async getStudentODHistory(userId: number) {
    return this.request(`/events/student-od/${userId}`);
  }

  // Phone mentoring - volunteer daily updates
  async getMyPhoneMentoringAssignment() {
    return this.request('/phone-mentoring/my-assignment');
  }

  // This uses FormData, so we bypass the JSON helper and call fetch directly.
  async submitPhoneMentoringUpdate(formData: FormData) {
    const url = `${this.baseURL}/phone-mentoring`;
    const headers: HeadersInit = {};
    // Do not set Content-Type; browser will set multipart/form-data boundary for FormData
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers
    });

    const contentType = response.headers.get('content-type');
    const data = contentType && contentType.includes('application/json')
      ? await response.json()
      : { success: response.ok };

    if (!response.ok) {
      throw new Error(data.message || 'Failed to submit phone mentoring update');
    }

    return data;
  }

  async getMyMentees() {
    return this.request('/phone-mentoring/my-mentees');
  }

  async saveMentorAttendance(assignmentId: number, data: { date?: string; status: string; notes?: string; call_recording?: File }) {
    const formData = new FormData();
    if (data.date) formData.append('date', data.date);
    formData.append('status', data.status);
    if (data.notes) formData.append('notes', data.notes);
    if (data.call_recording) formData.append('call_recording', data.call_recording);

    const token = sessionStorage.getItem('auth_token');
    const url = `${this.baseURL}/phone-mentoring/mentees/${assignmentId}/attendance`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    return response.json();
  }

  async updateMentorAttendance(assignmentId: number, attendanceId: number, data: { date?: string; status: string; notes?: string; call_recording?: File }) {
    const formData = new FormData();
    if (data.date) formData.append('date', data.date);
    formData.append('status', data.status);
    if (data.notes) formData.append('notes', data.notes);
    if (data.call_recording) formData.append('call_recording', data.call_recording);

    const token = sessionStorage.getItem('auth_token');
    const url = `${this.baseURL}/phone-mentoring/mentees/${assignmentId}/attendance/${attendanceId}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    return response.json();
  }

  async deleteMentorAttendance(assignmentId: number, attendanceId: number) {
    return this.request(`/phone-mentoring/mentees/${assignmentId}/attendance/${attendanceId}`, {
      method: 'DELETE',
    });
  }

  async getMentorAttendance(assignmentId: number, date?: string) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request(`/phone-mentoring/mentees/${assignmentId}/attendance${qs}`);
  }

  async getPhoneMentoringAttendance(params?: { date?: string; volunteerId?: number; status?: string; projectId?: number; assignmentId?: number }) {
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.volunteerId) query.append('volunteerId', params.volunteerId.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.projectId) query.append('projectId', params.projectId.toString());
    if (params?.assignmentId) query.append('assignmentId', params.assignmentId.toString());
    const qs = query.toString();
    return this.request(`/phone-mentoring/attendance${qs ? `?${qs}` : ''}`);
  }

  async getMentorMenteeUpdates(assignmentId: number) {
    return this.request(`/phone-mentoring/mentees/${assignmentId}/updates`);
  }

  // Phone mentoring - admin view
  async getPhoneMentoringUpdates(params?: { date?: string; volunteerId?: number; status?: string; projectId?: number; assignmentId?: number }) {
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.volunteerId) query.append('volunteerId', params.volunteerId.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.projectId) query.append('projectId', params.projectId.toString());
    if (params?.assignmentId) query.append('assignmentId', params.assignmentId.toString());
    const qs = query.toString();
    return this.request(`/phone-mentoring/updates${qs ? `?${qs}` : ''}`);
  }

  async getProjectMentees(projectId: number) {
    return this.request(`/projects/${projectId}/mentees`);
  }

  async createProjectMentee(projectId: number, payload: any) {
    return this.request(`/projects/${projectId}/mentees`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateProjectMentee(projectId: number, assignmentId: number, payload: any) {
    return this.request(`/projects/${projectId}/mentees/${assignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  async deleteProjectMentee(projectId: number, assignmentId: number) {
    return this.request(`/projects/${projectId}/mentees/${assignmentId}`, {
      method: 'DELETE'
    });
  }

  async submitMenteeAttendance(projectId: number, data: { date: string; records: Array<{ assignmentId: number; status: string; notes?: string }> }) {
    return this.request(`/projects/${projectId}/mentees/attendance`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getMenteeAttendance(projectId: number, assignmentId: number, date?: string) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request(`/projects/${projectId}/mentees/${assignmentId}/attendance${qs}`);
  }

  async getMenteeUpdates(projectId: number, assignmentId: number) {
    return this.request(`/projects/${projectId}/mentees/${assignmentId}/updates`);
  }

  // Time Management API methods
  async getTimeRequests(userId?: number, status?: string) {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId.toString());
    if (status) params.append('status', status);
    return this.request(`/time/requests?${params.toString()}`);
  }

  async createTimeRequest(projectId: number | null, hours: number, date: string, deadline?: string, description?: string) {
    return this.request('/time/requests', {
      method: 'POST',
      body: JSON.stringify({ projectId, hours, date, deadline, description }),
    });
  }

  async updateTimeRequestStatus(requestId: number, status: 'approved' | 'rejected') {
    return this.request(`/time/requests/${requestId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async getTimeAllotments(userId?: number, projectId?: number) {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId.toString());
    if (projectId) params.append('projectId', projectId.toString());
    return this.request(`/time/allotments?${params.toString()}`);
  }

  logout() {
    this.setToken(null);
    sessionStorage.removeItem('auth_user');
  }
}

export const api = new ApiClient(API_BASE_URL);

