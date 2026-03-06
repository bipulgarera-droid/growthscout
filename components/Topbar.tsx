import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { Briefcase, ChevronDown, Plus, Check } from 'lucide-react';

const Topbar = () => {
    const { projects, activeProject, setActiveProject, createProject } = useProject();
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;

        try {
            await createProject(newProjectName.trim());
            setNewProjectName('');
            setIsCreating(false);
            setIsOpen(false);
        } catch (error) {
            alert("Failed to create project");
        }
    };

    return (
        <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
            <div className="font-semibold text-slate-800">
                Prospecting Hub
            </div>

            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 transition-colors"
                >
                    <Briefcase size={16} className="text-brand-600" />
                    {activeProject ? activeProject.name : 'Select Project'}
                    <ChevronDown size={14} className="text-slate-400" />
                </button>

                {isOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden">
                        <div className="max-h-60 overflow-y-auto py-1">
                            {projects.map(project => (
                                <button
                                    key={project.id}
                                    onClick={() => {
                                        setActiveProject(project);
                                        setIsOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                                >
                                    <span className={`truncate ${activeProject?.id === project.id ? 'font-medium text-brand-600' : 'text-slate-700'}`}>
                                        {project.name}
                                    </span>
                                    {activeProject?.id === project.id && <Check size={14} className="text-brand-600 shrink-0" />}
                                </button>
                            ))}
                        </div>

                        <div className="border-t border-slate-100 p-2 bg-slate-50">
                            {isCreating ? (
                                <form onSubmit={handleCreate} className="flex flex-col gap-2">
                                    <input
                                        type="text"
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        placeholder="Project Name..."
                                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-brand-500"
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="submit"
                                            disabled={!newProjectName.trim()}
                                            className="flex-1 bg-brand-600 text-white text-xs py-1.5 rounded hover:bg-brand-700 disabled:opacity-50"
                                        >
                                            Create
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsCreating(false); setNewProjectName(''); }}
                                            className="flex-1 bg-slate-200 text-slate-700 text-xs py-1.5 rounded hover:bg-slate-300"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded transition-colors"
                                >
                                    <Plus size={14} />
                                    New Project
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Topbar;
