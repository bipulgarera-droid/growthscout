import React, { createContext, useContext, useState, useEffect } from 'react';
import { Project } from '../types';
import { getProjects, createProject } from '../services/backendApi';

interface ProjectContextType {
    projects: Project[];
    activeProject: Project | null;
    setActiveProject: (project: Project | null) => void;
    createProject: (name: string, description?: string) => Promise<Project>;
    isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        setIsLoading(true);
        try {
            const data = await getProjects();
            setProjects(data || []);

            // Auto-select legacy project or most recent if none selected
            if (data && data.length > 0) {
                const legacy = data.find(p => p.name === 'Legacy Search Data');
                setActiveProject(legacy || data[0]);
            }
        } catch (error) {
            console.error('Error loading projects:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateProject = async (name: string, description: string = ''): Promise<Project> => {
        try {
            const data = await createProject(name, description);
            setProjects(prev => [data, ...prev]);
            setActiveProject(data);
            return data;
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    };

    return (
        <ProjectContext.Provider value={{ projects, activeProject, setActiveProject, createProject: handleCreateProject, isLoading }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};
