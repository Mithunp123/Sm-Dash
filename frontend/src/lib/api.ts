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
    const headers: any = {
      ...options.headers,
    };

    // Only set Content-Type to json if NOT FormData and not explicitly set
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

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
          // Keep token for change-password so a bad attempt doesn't log the user out
          const shouldKeepToken = endpoint === '/auth/change-password';
          // For login endpoint, don't clear token on failure
          if (endpoint !== '/auth/login' && !shouldKeepToken) {
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
    try {
      const response = await this.request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.success && response.token) {
        this.setToken(response.token);
      }

      return response;
    } catch (error: any) {
      // Re-throw with a more user-friendly message
      if (error.message.includes('Invalid email or password') || error.message.includes('401')) {
        throw new Error('Invalid email or password. Please check your credentials and try again.');
      }
      throw error;
    }
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

  async getRoleByEmail(email: string) {
    return this.request('/auth/get-role-by-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
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
        if (user && (user.role === 'admin' || user.role === 'office_bearer')) {
          const response = await this.request('/users');

          const isForbidden = !response.success && (
            response.message?.toLowerCase().includes('forbidden') ||
            response.message?.toLowerCase().includes('denied') ||
            response.status === 403
          );

          if (!isForbidden) {
            return response;
          }

          // If forbidden (e.g. OB without full access), and is OB, fall back to scoped
          if (user.role === 'office_bearer') {
            const scopedRes = await this.request('/users/students');
            const isScopedForbidden = !scopedRes.success && (
              scopedRes.message?.toLowerCase().includes('forbidden') ||
              scopedRes.message?.toLowerCase().includes('denied') ||
              scopedRes.message?.toLowerCase().includes('permission') ||
              scopedRes.status === 403
            );

            if (isScopedForbidden) {
              return { success: true, students: [] }; // Keep students key for internal consistency if needed
            }
            if (scopedRes.success && scopedRes.students) {
              return { success: true, users: scopedRes.students } as any;
            }
            return { success: true, users: [] } as any;
          }

          return { success: true, users: [] };
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

  // Get contacts (admins and office bearers) - for students to message
  async getContacts() {
    if (!this.token) {
      console.warn('Skipping /users/contacts call: no auth token present');
      return { success: true, contacts: [] };
    }
    const response = await this.request('/users/contacts');
    if (!response.success && response.message?.includes('forbidden')) {
      return { success: true, contacts: [] };
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

  async getMeetingAttendance(meetingId: number, date?: string) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request(`/attendance/meeting/${meetingId}/records${query}`);
  }

  async markAttendance(attendanceData: any) {
    // Ensure snake_case for backend
    const payload = {
      ...attendanceData,
      user_id: attendanceData.userId || attendanceData.user_id,
      meeting_id: attendanceData.meetingId || attendanceData.meeting_id,
      attendance_date: attendanceData.attendance_date || attendanceData.date
    };
    return this.request('/attendance', {
      method: 'POST',
      body: JSON.stringify(payload),
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
    // Map userId to user_id
    const payload = {
      ...data,
      user_id: data.userId
    };
    return this.request(`/attendance/project/${projectId}/mark`, {
      method: 'POST',
      body: JSON.stringify(payload),
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

  // Awards endpoints
  async getAwards(year?: string) {
    const qs = year ? `?year=${encodeURIComponent(year)}` : '';
    return this.request(`/awards${qs}`);
  }

  async getPublicAwards(year?: string) {
    const qs = year ? `?year=${encodeURIComponent(year)}` : '';
    const fullUrl = `${this.baseURL}/awards/public${qs}`;
    try {
      const res = await fetch(fullUrl);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Don't throw error - return empty array so page still works
        return { success: true, awards: [], message: err.message || 'Failed to fetch awards' };
      }
      return await res.json();
    } catch (err: any) {
      // Handle connection errors gracefully - return empty result instead of failing
      if (err?.message?.includes('Failed to fetch') || err?.message?.includes('ERR_CONNECTION_REFUSED') || err?.name === 'TypeError') {
        return { success: true, awards: [] };
      }
      return { success: true, awards: [], message: err.message || 'Failed to fetch awards' };
    }
  }

  async createAward(formData: FormData) {
    const url = `${this.baseURL}/awards`;
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(url, { method: 'POST', body: formData, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to create award');
    }
    return data;
  }

  async updateAward(id: number, formData: FormData) {
    const url = `${this.baseURL}/awards/${id}`;
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(url, { method: 'PUT', body: formData, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update award');
    }
    return data;
  }

  async deleteAward(id: number) {
    return this.request(`/awards/${id}`, { method: 'DELETE' });
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

  // Backup & Restore
  async exportBackup() {
    return this.request('/settings/backup/export');
  }

  async restoreBackup(backupData: any) {
    return this.request('/settings/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ backup: backupData })
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

  async getResources() {
    const response = await this.request('/resources');
    if (!response.success && response.message?.includes('forbidden')) {
      return { success: true, resources: [] };
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

  async deleteProject(projectId: number) {
    return this.request(`/projects/${projectId}`, {
      method: 'DELETE'
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
  async getBills(param?: number | { eventId?: number; folderId?: number }) {
    if (typeof param === 'number') {
      return this.request(`/bills?event_id=${param}`);
    }
    if (param?.eventId || param?.folderId) {
      const query = new URLSearchParams();
      if (param.eventId) query.append('event_id', param.eventId.toString());
      if (param.folderId) query.append('folderId', param.folderId.toString());
      return this.request(`/bills?${query.toString()}`);
    }
    return this.request('/bills');
  }

  async uploadBill(formData: FormData) {
    return this.request('/bills', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type with boundary for FormData
    });
  }

  // Legacy method for backward compatibility
  async getBillsLegacy(params?: { folderId?: number }) {
    let endpoint = '/bills';
    if (params?.folderId) {
      const query = new URLSearchParams();
      query.append('folderId', params.folderId.toString());
      endpoint = `/bills?${query.toString()}`;
    }
    return this.request(endpoint);
  }


  // Bill folders
  async getBillFolders(parentId?: number | null) {
    const query = parentId !== undefined && parentId !== null ? `?parent_id=${parentId}` : '';
    return this.request(`/bills/folders${query}`);
  }

  async createBillFolder(folderData: { name: string; description?: string; parent_folder_id?: number | null }, files?: File[]) {
    if (files && files.length > 0) {
      // Use FormData for file uploads
      const formData = new FormData();
      formData.append('name', folderData.name);
      if (folderData.description) formData.append('description', folderData.description);
      if (folderData.parent_folder_id !== undefined && folderData.parent_folder_id !== null) {
        formData.append('parent_folder_id', folderData.parent_folder_id.toString());
      }
      files.forEach(file => formData.append('files', file));

      const url = `${this.baseURL}/bills/folders`;
      const headers: HeadersInit = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create folder');
      }
      return response.json();
    } else {
      // No files, use JSON
      return this.request('/bills/folders', {
        method: 'POST',
        body: JSON.stringify(folderData),
      });
    }
  }

  async updateBillFolder(folderId: number, folderData: any) {
    return this.request(`/bills/folders/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify(folderData),
    });
  }

  async deleteBillFolder(folderId: number) {
    return this.request(`/bills/folders/${folderId}`, {
      method: 'DELETE',
    });
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

  async uploadBillImages(billId: number, formData: FormData) {
    // Note: When sending FormData, do not set Content-Type header manually, let fetch handle it with boundary
    const url = `${this.baseURL}/bills/${billId}/images`;
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to upload images');
    }
    return response.json();
  }

  async getBillImages(billId: number) {
    return this.request(`/bills/${billId}/images`);
  }

  async deleteBillImage(imageId: number) {
    return this.request(`/bills/images/${imageId}`, { method: 'DELETE' });
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



  async bulkAssignStudentsToProject(projectId: number, studentIds: number[]) {
    return this.request(`/projects/${projectId}/bulk-assign-students`, {
      method: 'POST',
      body: JSON.stringify({ studentIds }),
    });
  }

  async bulkUploadStudents(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/students/bulk-upload', {
      method: 'POST',
      body: formData,
    });
  }

  async bulkUploadCandidates(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/interviews/bulk-upload', {
      method: 'POST',
      body: formData,
    });
  }

  async getCandidates() {
    return this.request('/interviews');
  }

  async addCandidate(data: any) {
    return this.request('/interviews/add', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCandidate(id: number, data: any) {
    return this.request(`/interviews/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async sendInterviewEmails(candidateIds: number[]) {
    return this.request('/interviews/send-emails', {
      method: 'POST',
      body: JSON.stringify({ candidateIds }),
    });
  }

  async getMyInterviewStatus() {
    return this.request('/interviews/my-status');
  }

  // Get candidates assigned to current mentor/interviewer
  async getMyInterviewCandidates() {
    return this.request('/interviews/my-candidates');
  }

  // Submit interview marks (mentor only, one-time submission)
  async submitInterviewMarks(candidateId: number, data: { marks: number; remarks?: string }) {
    return this.request(`/interviews/${candidateId}/submit-marks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Assign mentor to candidate (admin only)
  async assignInterviewMentor(candidateId: number, data: { mentor_id: number; mentor_name: string }) {
    return this.request(`/interviews/${candidateId}/assign-mentor`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Send bulk email via SMTP
  async sendBulkEmail(data: { recipients: string[]; subject: string; body: string; html?: boolean; priority?: number; type: string }) {
    return this.request('/mail/send-bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Chat message methods
  async getConversations() {
    return this.request('/messages/conversations');
  }

  async getMessageHistory(contactId: number) {
    return this.request(`/messages/history/${contactId}`);
  }

  async sendChatMessage(payload: { recipientId: number; message: string; replyToId?: number }) {
    return this.request('/messages/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async deleteChatMessage(messageId: number) {
    return this.request(`/messages/${messageId}`, {
      method: 'DELETE'
    });
  }

  // Announcement endpoints
  async getAnnouncements() {
    // Landing page ticker needs this publicly occasionally, but for now we'll use authenticated req
    // Since it's for landing page, if no token, we can try public endpoint if exists
    return this.request('/announcements');
  }

  async createAnnouncement(data: any) {
    return this.request('/announcements', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateAnnouncement(id: number, data: any) {
    return this.request(`/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteAnnouncement(id: number) {
    return this.request(`/announcements/${id}`, {
      method: 'DELETE'
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

  // Public events endpoint (no authentication required)
  async getPublicEvents(year?: string, month?: string) {
    let url = '/events/public';
    const params: string[] = [];
    if (year) params.push(`year=${encodeURIComponent(year)}`);
    if (month) params.push(`month=${encodeURIComponent(month)}`);
    if (params.length) url = `/events/public?${params.join('&')}`;

    // Make request without authentication
    const fullUrl = `${this.baseURL}${url}`;
    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch events' }));
        throw new Error(error.message || 'Failed to fetch events');
      }

      return response.json();
    } catch (error: any) {
      // Handle connection errors gracefully
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('ERR_CONNECTION_REFUSED') || error?.name === 'TypeError') {
        // Backend is not available, return empty result
        return { success: true, events: [] };
      }
      // Re-throw other errors
      throw error;
    }
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

  async markEventOD(eventId: number, userId: number, status: 'od' | 'absent' | 'permission', date?: string) {
    return this.request(`/events/${eventId}/od`, {
      method: 'POST',
      body: JSON.stringify({ userId, status, date }),
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

  async bulkUpdateExpectedClasses(projectId: number, expectedClasses: number | null) {
    return this.request(`/projects/${projectId}/mentees/bulk-expected-classes`, {
      method: 'PUT',
      body: JSON.stringify({ expected_classes: expectedClasses }),
    });
  }

  async bulkUpdateExpectedClassesAll(expectedClasses: number | null) {
    return this.request(`/projects/mentees/bulk-expected-classes-all`, {
      method: 'PUT',
      body: JSON.stringify({ expected_classes: expectedClasses }),
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

  // ============================================
  // EVENT REGISTRATION (Student)
  // ============================================

  async registerForEvent(eventId: number, registrationType: 'volunteer' | 'participant' = 'volunteer', notes?: string) {
    return this.request(`/events/${eventId}/register`, {
      method: 'POST',
      body: JSON.stringify({ registration_type: registrationType, notes }),
    });
  }

  async getMyEventRegistrations() {
    return this.request('/events/my-registrations');
  }

  async getActiveEvents() {
    return this.request('/events/active');
  }

  async getEventRegistrations(eventId: number) {
    return this.request(`/events/${eventId}/registrations`);
  }

  async getEvent(eventId: number) {
    return this.request(`/events/${eventId}`);
  }

  async assignVolunteerToEvent(eventId: number, userId: number, data: { status?: string; notes?: string }) {
    return this.request(`/events/${eventId}/volunteers/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, ...data }),
    });
  }

  // ============================================
  // VOLUNTEER REGISTRATION (Public)
  // ============================================

  async volunteerRegister(data: {
    name: string;
    email: string;
    register_no?: string;
    year?: string;
    department?: string;
    phone?: string;
    parent_phone?: string;
    address?: string;
    dob?: string;
    blood_group?: string;
    skills?: string;
    experience?: string;
  }) {
    return this.request('/users/volunteer-register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Office Bearers endpoints
  async getOfficeBearers() {
    return this.request('/office-bearers');
  }

  async getPublicOfficeBearers() {
    const fullUrl = `${this.baseURL}/office-bearers/public`;
    try {
      const res = await fetch(fullUrl);
      if (!res.ok) return { success: true, officeBearers: [] };
      return res.json();
    } catch (e) {
      return { success: true, officeBearers: [] };
    }
  }

  async createOfficeBearer(formData: FormData) {
    const url = `${this.baseURL}/office-bearers`;
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(url, { method: 'POST', body: formData, headers });
    return res.json();
  }

  async updateOfficeBearer(id: number, formData: FormData) {
    const url = `${this.baseURL}/office-bearers/${id}`;
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(url, { method: 'PUT', body: formData, headers });
    return res.json();
  }

  async deleteOfficeBearer(id: number) {
    return this.request(`/office-bearers/${id}`, { method: 'DELETE' });
  }

  async logout() {
    this.setToken(null);
    sessionStorage.removeItem('auth_user');
  }
  async uploadPhoto(formData: FormData) {
    const url = `${this.baseURL}/upload/photo`;
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers
    });
    const data = await response.json().catch(() => ({ success: false, message: 'Invalid server response' }));
    if (!response.ok) {
      throw new Error(data.message || `Upload failed with status ${response.status}`);
    }
    return data;
  }
}

export const api = new ApiClient(API_BASE_URL);

