import { create } from 'zustand';
import { getApiUrl, useSomStore } from './somStore';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'Admin' | 'User';
}

export interface CloudProjectHeader {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  permission: string;
  ownerUsername: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isWebMode: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Projects state
  ownedProjects: CloudProjectHeader[];
  sharedProjects: CloudProjectHeader[];
  isProjectsLoading: boolean;

  // Actions
  checkAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  fetchUserProjects: () => Promise<void>;
  saveCloudProject: (title: string, description?: string, projectId?: string) => Promise<boolean>;
  loadCloudProject: (projectId: string, projectTitle?: string) => Promise<boolean>;
  shareProject: (projectId: string, target: string, permission: string) => Promise<boolean>;
  deleteCloudProject: (projectId: string) => Promise<boolean>;
  createUser: (username: string, email: string, password: string, role: string) => Promise<boolean>;
  fetchUsers: () => Promise<User[]>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('knomap_jwt_token'),
  user: null,
  isWebMode: typeof window !== 'undefined' && window.location.protocol.startsWith('http'),
  isAuthenticated: false,
  isLoading: true,
  error: null,

  ownedProjects: [],
  sharedProjects: [],
  isProjectsLoading: false,

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    const token = get().token;
    
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(getApiUrl('/api/auth/me'), { headers });
      const data = await response.json();

      if (data.success && data.user) {
        set({
          user: data.user,
          isWebMode: data.isWebMode ?? true,
          isAuthenticated: true,
          token: data.token || token,
          isLoading: false
        });
        if (data.token) {
          localStorage.setItem('knomap_jwt_token', data.token);
        }
      } else {
        set({
          user: null,
          isWebMode: data.isWebMode ?? true,
          isAuthenticated: false,
          isLoading: false
        });
      }
    } catch (err: any) {
      console.error('Auth check error:', err);
      // If we are over HTTP/HTTPS, fallback to web mode so we don't bypass login screen on network errors
      const fallbackWebMode = typeof window !== 'undefined' && window.location.protocol.startsWith('http');
      set({ isLoading: false, isAuthenticated: false, isWebMode: fallbackWebMode });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (data.success && data.token) {
        localStorage.setItem('knomap_jwt_token', data.token);
        set({
          token: data.token,
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
        get().fetchUserProjects();
        return true;
      } else {
        set({ error: data.error || 'Invalid credentials', isLoading: false });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message || 'Network error logging in', isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('knomap_jwt_token');
    set({ token: null, user: null, isAuthenticated: false, ownedProjects: [], sharedProjects: [] });
  },

  fetchUserProjects: async () => {
    const token = get().token;
    if (!token) return;

    set({ isProjectsLoading: true });
    try {
      const response = await fetch(getApiUrl('/api/projects'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.data) {
        set({
          ownedProjects: data.data.owned || [],
          sharedProjects: data.data.shared || [],
          isProjectsLoading: false
        });
      } else {
        set({ isProjectsLoading: false });
      }
    } catch (err) {
      console.error('Failed to fetch user projects:', err);
      set({ isProjectsLoading: false });
    }
  },

  saveCloudProject: async (title, description, projectId) => {
    const token = get().token;
    if (!token) return false;

    // Use passed projectId or active cloudProjectId from somStore
    const targetProjectId = projectId || useSomStore.getState().cloudProjectId || undefined;

    // Ensure all InCites unit tabs are pre-cached before saving to cloud
    await useSomStore.getState().ensureAllIncitesUnitsCached();

    // Get current complete state payload from somStore
    const payload = useSomStore.getState().getProjectPayload();

    try {
      const response = await fetch(getApiUrl('/api/projects'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: targetProjectId,
          title,
          description,
          payload
        })
      });

      const data = await response.json();
      if (data.success && data.project) {
        useSomStore.setState({
          cloudProjectId: data.project.id,
          cloudProjectTitle: data.project.title
        });
        await get().fetchUserProjects();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to save project to server:', err);
      return false;
    }
  },

  loadCloudProject: async (projectId: string, projectTitle?: string) => {
    const token = get().token;
    if (!token) return false;

    try {
      const response = await fetch(getApiUrl(`/api/projects/${projectId}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const projectData = await response.json();
      if (projectData && (projectData.version || projectData.config || projectData.incitesUnitNames || projectData.result || projectData.dataMatrix)) {
        useSomStore.getState().importProject(JSON.stringify(projectData));
        useSomStore.setState({
          cloudProjectId: projectId,
          cloudProjectTitle: projectTitle || projectData.cloudProjectTitle || null
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to load project from server:', err);
      return false;
    }
  },

  shareProject: async (projectId, target, permission) => {
    const token = get().token;
    if (!token) return false;

    try {
      const response = await fetch(getApiUrl(`/api/projects/${projectId}/share`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ target, permission })
      });
      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error('Failed to share project:', err);
      return false;
    }
  },

  deleteCloudProject: async (projectId) => {
    const token = get().token;
    if (!token) return false;

    try {
      const response = await fetch(getApiUrl(`/api/projects/${projectId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        await get().fetchUserProjects();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete project:', err);
      return false;
    }
  },

  createUser: async (username, email, password, role) => {
    const token = get().token;
    if (!token) return false;

    try {
      const response = await fetch(getApiUrl('/api/auth/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, email, password, role })
      });
      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error('Failed to create user:', err);
      return false;
    }
  },

  fetchUsers: async () => {
    const token = get().token;
    if (!token) return [];

    try {
      const response = await fetch(getApiUrl('/api/auth/users'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      return data.success ? data.users : [];
    } catch (err) {
      console.error('Failed to fetch users:', err);
      return [];
    }
  }
}));
