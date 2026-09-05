import { useState, useEffect, useCallback } from 'react';
import { supabaseService, ProjectRecord } from '../services/supabaseService';

export function useProjects() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseService.getProjects();
      setProjects(data);
      if (data.length > 0 && !activeProject) {
        setActiveProject(data[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  const createProject = async (name: string, description?: string) => {
    const newProj = await supabaseService.createProject(name, description);
    if (newProj) {
      setProjects((prev) => [newProj, ...prev]);
      setActiveProject(newProj);
    }
    return newProj;
  };

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    activeProject,
    setActiveProject,
    loading,
    error,
    refreshProjects: loadProjects,
    createProject,
  };
}
