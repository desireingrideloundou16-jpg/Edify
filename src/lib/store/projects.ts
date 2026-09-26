import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Project, MOCK_PROJECTS } from "@/types/project";
import { PackagingTemplateId, BoxDimensions } from "@/types/packaging";
import { TEMPLATES } from "@/lib/constants";

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;
  hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  setActiveProjectId: (id: string | null) => void;
  getProject: (id: string) => Project | undefined;
  addProject: (
    name: string,
    templateId: PackagingTemplateId,
    dimensions?: BoxDimensions
  ) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => Project | undefined;
  resetToDefaults: () => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: MOCK_PROJECTS,
      activeProjectId: null,
      hasHydrated: false,

      setHasHydrated: (state: boolean) => set({ hasHydrated: state }),

      setActiveProjectId: (id) => set({ activeProjectId: id }),

      getProject: (id) => {
        return get().projects.find((p) => p.id === id);
      },

      addProject: (name, templateId, _customDimensions) => {
        const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
        const newProject: Project = {
          id: `proj-${Date.now()}`,
          user_id: "user-demo",
          name: name.trim() || `Nouveau Projet (${template.name})`,
          status: "draft",
          template_id: templateId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          projects: [newProject, ...state.projects],
          activeProjectId: newProject.id,
        }));

        return newProject;
      },

      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...updates,
                  updated_at: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId:
            state.activeProjectId === id ? null : state.activeProjectId,
        }));
      },

      duplicateProject: (id) => {
        const original = get().projects.find((p) => p.id === id);
        if (!original) return undefined;

        const copy: Project = {
          ...original,
          id: `proj-${Date.now()}`,
          name: `${original.name} (Copie)`,
          status: "draft",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          projects: [copy, ...state.projects],
        }));

        return copy;
      },

      resetToDefaults: () => {
        set({ projects: MOCK_PROJECTS, activeProjectId: null });
      },
    }),
    {
      name: "edify-projects-storage",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
