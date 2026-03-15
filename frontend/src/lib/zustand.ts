import { create } from 'zustand';

type AgentType = 'Single Prompt' | 'Multi Prompt' | 'Custom LLM';

type Agent = {
  id: string;
  name: string;
  agentType: AgentType;
  agentConfig: any;
  phoneNumber?: string | null;
  provider: string;
  providerAgentId?: string | null;
  status: string;
  lastEditedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

const useStore = create((set, get) => ({
  // state
  agents: [],
  loading: false,
  error: null,
  createModalOpen: false,
  modalOpen: false,
  modalMode: null,
  modalAgent: null,
  selectedVoicePage:'',

  // functions
  setSelectedVoicePage:(val)=>set({selectedVoicePage:val}),
  openEdit: (agent) => {
    set({ modalMode: 'edit', modalAgent: { ...agent, agentConfig: agent.agentConfig || {} }, modalOpen: true });
  },

  openAssignPhone: (agent) => {
    set({ modalMode: 'assignPhone', modalAgent: agent, modalOpen: true });
  },

  closeModal: () => {
    set({ modalOpen: false, modalAgent: null, modalMode: null });
  },

  handleSave: async (modalAgent, modalMode, apiFetch, router, fetchAgents) => {
    if (!modalAgent) return;
    try {
      if (modalMode === 'edit' && modalAgent.id) {
        const patchBody: any = { agentConfig: modalAgent.agentConfig };
        if (modalAgent.name) patchBody.name = modalAgent.name;
        if (modalAgent.agentType) patchBody.agentType = modalAgent.agentType;
        await apiFetch(`/voice-agents/${modalAgent.id}`, {
          method: 'PATCH',
          body: JSON.stringify(patchBody)
        });
      }
      fetchAgents();
      get().closeModal();
    } catch (err: any) {
      alert(err.message);
    }
  },

  handleDelete: async (agent, apiFetch, router, fetchAgents) => {
    try {
      await apiFetch(`/voice-agents/${agent.id}`, { method: 'DELETE' });
      fetchAgents();
    } catch (err: any) {
      alert(err.message);
    }
  },

  handleDuplicate: async (agent, apiFetch, router, fetchAgents) => {
    const { id, ...rest } = agent as any;
    const copy = { ...rest, name: `${agent.name} (copy)` } as Partial<Agent>;
    try {
      await apiFetch('/voice-agents', { method: 'POST', body: JSON.stringify(copy) });
      fetchAgents();
    } catch (err: any) {
      alert(err.message);
    }
  },

  setCreateModalOpen: (value) => set({ createModalOpen: value }),

  setModalAgent: (agent) => set({ modalAgent: agent }),

  setAgents: (agents) => set({ agents }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}));

export { useStore };