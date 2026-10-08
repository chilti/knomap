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
  isReadOnlyDemo: boolean;
  isDemoLoading: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Projects state
  ownedProjects: CloudProjectHeader[];
  sharedProjects: CloudProjectHeader[];
  isProjectsLoading: boolean;

  // Actions
  checkAuth: () => Promise<void>;
  loadDemoProject: () => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  fetchUserProjects: () => Promise<void>;
  saveCloudProject: (title: string, description?: string, projectId?: string | null) => Promise<boolean>;
  loadCloudProject: (projectId: string, projectTitle?: string) => Promise<boolean>;
  shareProject: (projectId: string, target: string, permission: string) => Promise<boolean>;
  deleteCloudProject: (projectId: string) => Promise<boolean>;
  createUser: (username: string, email: string, password: string, role: string) => Promise<boolean>;
  fetchUsers: () => Promise<User[]>;
}

async function compressJsonToGzipBlob(data: any): Promise<Blob> {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
  const blob = new Blob([jsonString], { type: 'application/json' });
  
  if (typeof CompressionStream !== 'undefined') {
    const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
    return await new Response(stream).blob();
  }
  
  return blob;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('knomap_jwt_token'),
  user: null,
  isWebMode: typeof window !== 'undefined' && window.location.protocol.startsWith('http'),
  isAuthenticated: false,
  isReadOnlyDemo: false,
  isDemoLoading: false,
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
          isReadOnlyDemo: false,
          token: data.token || token,
          isLoading: false
        });
        if (data.token) {
          localStorage.setItem('knomap_jwt_token', data.token);
        }
      } else {
        const isWeb = data.isWebMode ?? true;
        set({
          user: null,
          isWebMode: isWeb,
          isAuthenticated: false,
          isReadOnlyDemo: isWeb,
          isLoading: false
        });
        if (isWeb) {
          get().loadDemoProject();
        }
      }
    } catch (err: any) {
      console.error('Auth check error:', err);
      // If we are over HTTP/HTTPS, fallback to web mode so we don't bypass login screen on network errors
      const fallbackWebMode = typeof window !== 'undefined' && window.location.protocol.startsWith('http');
      set({ isLoading: false, isAuthenticated: false, isReadOnlyDemo: fallbackWebMode, isWebMode: fallbackWebMode });
      if (fallbackWebMode) {
        get().loadDemoProject();
      }
    }
  },

  loadDemoProject: async () => {
    const currentSom = useSomStore.getState();
    const hasData = (currentSom.labels && currentSom.labels.length > 0) || currentSom.documentCount > 0;
    if (hasData && currentSom.cloudProjectTitle?.includes("Artificial_Intelligence_in_Education")) {
      set({ isReadOnlyDemo: true });
      return true;
    }

    set({ isDemoLoading: true });
    try {
      const response = await fetch(getApiUrl('/api/projects/demo'));
      if (!response.ok) {
        throw new Error('Failed to load demo project');
      }
      const data = await response.json();
      const payloadString = typeof data === 'string' ? data : JSON.stringify(data);
      useSomStore.getState().importProject(payloadString);
      set({ isDemoLoading: false, isReadOnlyDemo: true });
      return true;
    } catch (err: any) {
      console.error('Failed to load demo project:', err);
      set({ isDemoLoading: false });
      return false;
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
          isReadOnlyDemo: false,
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
    const isWeb = get().isWebMode;
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isReadOnlyDemo: isWeb,
      ownedProjects: [],
      sharedProjects: []
    });
    if (isWeb) {
      get().loadDemoProject();
    }
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

    // If projectId is explicitly provided (including null), respect it. Only fallback if omitted (undefined).
    const targetProjectId = projectId !== undefined ? (projectId || undefined) : (useSomStore.getState().cloudProjectId || undefined);

    // Ensure all InCites and TlachIA unit tabs are pre-cached before saving to cloud
    await useSomStore.getState().ensureAllIncitesUnitsCached();
    await useSomStore.getState().ensureAllTlachiaUnitsCached();

    // Get current complete state payload from somStore
    const payload = useSomStore.getState().getProjectPayload();

    try {
      // 1. Compress payload with native GZIP in browser (reduces upload size by ~90%)
      const compressedBlob = await compressJsonToGzipBlob(payload);

      // 2. Prepare multipart form data
      const formData = new FormData();
      if (targetProjectId) formData.append('id', targetProjectId);
      formData.append('title', title);
      if (description) formData.append('description', description);
      formData.append('file', compressedBlob, 'project.json.gz');

      const response = await fetch(getApiUrl('/api/projects'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
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
      if (projectData && (projectData.version || projectData.config || projectData.incitesUnitNames || projectData.tlachiaUnitNames || projectData.result || projectData.dataMatrix)) {
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
