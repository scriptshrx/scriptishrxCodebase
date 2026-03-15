'use client'
import { useState, useMemo, useEffect } from 'react';
import {
  MoreVertical,
  Search as SearchIcon,
  Plus,
  ChevronDown,
  Bot,
  
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import CreateAgentModal from '@/components/voice/CreateAgentModal';

import { useRouter } from 'next/navigation';

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

type VoiceAgentsViewProps = {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  onFetchAgents: () => Promise<void>;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => Promise<void>;
  onDuplicate: (agent: Agent) => Promise<void>;
  createModalOpen: boolean;
  onCreateModalOpenChange: (open: boolean) => void;
};


// api helper (router is supplied by the caller)
const API_BASE = 'https://scriptshrxcodebase.onrender.com/api';

async function apiFetch(path: string, opts: any = {}, router?: any) {
  const headers: any = {
    'Content-Type': 'application/json',
    ...opts.headers
  };

  // Get auth token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    // try to decode JWT and check exp claim
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        console.warn('[apiFetch] token expired, redirecting to login');
        router?.push('/login');
        throw new Error('token_expired');
      }
    } catch (err) {
      // if parsing fails we still attempt request, but log
      console.warn('[apiFetch] failed to parse token payload', err);
    }

    headers['Authorization'] = `Bearer ${token}`;
    console.log('[apiFetch] Using token from localStorage');
  } else {
    console.warn('[apiFetch] No token found in localStorage');
  }

  const url = `${API_BASE}${path}`;
  console.log('[apiFetch] Requesting:', { url, method: opts.method || 'GET', hasAuth: !!token });

  const res = await fetch(url, {
    credentials: 'include',
    ...opts,
    headers
  });

  console.log('[apiFetch] Response status:', res.status);

  if (!res.ok) {
    const errText = await res.text();
    console.error('[apiFetch] Error response:', errText);
    let err: any = {};
    try {
      err = JSON.parse(errText);
    } catch {
      if (errText.includes('expired')) {
        router?.push('/login');
      }
      err = { error: errText || `HTTP ${res.status}` };
    }
    throw new Error(err.error || `Request failed with status ${res.status}`);
  }

  const data = await res.json();
  console.log('[apiFetch] Success response:', data);
  return data;
}
 const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedSideBar, setSelectSideBar] = useState('Voice Agents');
  const [tenant, setTenant] = useState<{ name: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'edit' | 'assignPhone' | null>(null);
  const [modalAgent, setModalAgent] = useState<Partial<Agent> | null>(null);

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[fetchAgents] Starting fetch from:', `${API_BASE}/voice-agents`);
      const data = await apiFetch('/voice-agents', {}, router);
      console.log('[fetchAgents] Raw response:', data);
      const list = (data.agents || []).map((a: any) => ({
        ...a,
        // ensure agentConfig exists
        agentConfig: a.agentConfig || {},
      }));
      console.log('[fetchAgents] Parsed agents:', list);
      setAgents(list);
      setLoading(false);
    }
    catch(e: any){
      console.error('[fetchAgents] Error:', e);
      const errorMsg = e?.message || String(e);
      setLoading(false)
      setError(errorMsg);
    }
  };

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if(userString){
      const userData = JSON.parse(userString);
      setUser(userData);
      setTenant(userData);
      console.log('User is', userString);
    }
    fetchAgents();
  }, []);

  // actions
  const openEdit = (agent: Agent) => {
    setModalMode('edit');
    setModalAgent({
      ...agent,
      agentConfig: agent.agentConfig || {},
    });
    setModalOpen(true);
  };

  const openAssignPhone = (agent: Agent) => {
    setModalMode('assignPhone');
    setModalAgent(agent);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAgent(null);
    setModalMode(null);
  };

  const handleSave = async () => {
    if (!modalAgent) return;
    try {
      if (modalMode === 'edit' && modalAgent.id) {
        const patchBody: any = { agentConfig: modalAgent.agentConfig };
        if (modalAgent.name) patchBody.name = modalAgent.name;
        if (modalAgent.agentType) patchBody.agentType = modalAgent.agentType;
        await apiFetch(`/voice-agents/${modalAgent.id}`, {
          method: 'PATCH',
          body: JSON.stringify(patchBody)
        }, router);
      }
      await fetchAgents();
      closeModal();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (agent: Agent) => {
    try {
      await apiFetch(`/voice-agents/${agent.id}`, { method: 'DELETE' }, router);
      await fetchAgents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDuplicate = async (agent: Agent) => {
    const { id, ...rest } = agent as any;
    const copy = { ...rest, name: `${agent.name} (copy)` } as Partial<Agent>;
    try {
      await apiFetch('/voice-agents', { method: 'POST', body: JSON.stringify(copy) }, router);
      await fetchAgents();
    } catch (err: any) {
      alert(err.message);
    }
  };

export default function VoiceAgentsView({
  agents,
  loading,
  error,
  onFetchAgents,
  onEdit,
  onDelete,
  onDuplicate,
  createModalOpen,
  onCreateModalOpenChange,
}: VoiceAgentsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'Newest' | 'Oldest'>('Newest');
  const [rowMenuOpenId, setRowMenuOpenId] = useState<string | null>(null);
 const router = useRouter();

  const filteredAgents = useMemo(() => {
    let arr = [...agents];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter(a => a.name.toLowerCase().includes(q));
    }
    arr.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sortOrder === 'Newest' ? tb - ta : ta - tb;
    });
    return arr;
  }, [agents, searchQuery, sortOrder]);

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`Delete agent '${agent.name}'?`)) return;
    try {
      await onDelete(agent);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDuplicate = async (agent: Agent) => {
    try {
      await onDuplicate(agent);
    } catch (err: any) {
      alert(err.message);
    }
  };

 
  return (
    <>
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Voice Agents</h1>
            <p className="text-sm text-gray-500">Manage Scriptish voice agents</p>
          </div>
          <div className="relative">
            <Button onClick={() => onCreateModalOpenChange(true)}
            variant="primary"
            size="default">
              <Plus className="w-4 h-4 mr-2" />Create Voice Agent <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* controls */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Input
              placeholder="Search agents by name"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 text-gray-800 dark:text-gray-300 placeholder:text-gray-800 dark:placeholder:text-gray-500 border border-gray-400 shadow-md"
            />
            <SearchIcon className="absolute text-blue-900 left-3 top-3 w-4 h-4" />
          </div>
          <div>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as any)}
              className="h-10 px-3 rounded-md border border-gray-300 bg-white dark:bg-gray-300 text-gray-700 text-sm"
            >
              <option>Newest</option>
              <option>Oldest</option>
            </select>
          </div>
        </div>

        {/* list */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto dark:bg-gray-800 dark:border-gray-700">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-red-600">
                    <div className="text-sm font-semibold">Error: {error}</div>
                  </td>
                </tr>
              )}
              {!loading && !error && filteredAgents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No agents found.
                  </td>
                </tr>
              )}
              {filteredAgents.map(agent => (
                <tr
                  key={agent.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer relative"
                >
                  <td className="px-6 py-4 text-blue-900 dark:text-blue-500 font-bold flex items-center gap-2">
                    <Bot className="text-blue-700 w-4 h-4" />
                    {agent.name}
                  </td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-400">
                    {agent.agentType}
                  </td>
                  <td className={`px-6 ${agent.status=='active'?'text-green-500':'text-gray-600'} dark:text-gray-400 py-4`}>
                    {agent.status}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-400">
                    {new Date(agent.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right relative">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setRowMenuOpenId(rowMenuOpenId === agent.id ? null : agent.id);
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                    >
                      <MoreVertical className="w-4 h-4 text-blue-800" />
                    </button>
                    {rowMenuOpenId === agent.id && (
                      <div className="absolute cursor-pointer right-4 top-10 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-[50] dark:bg-gray-800 dark:border-gray-700">
                        <button
                          onClick={() => {
                            localStorage.setItem('template',JSON.stringify(agent));
                            console.log(agent);
                            router?.push(`/voice/new/${agent.mode}?editing=true`);
                            
                            // onEdit(agent);
                            //setRowMenuOpenId(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-100/50 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            handleDuplicate(agent);
                            setRowMenuOpenId(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 bg:hover:bg-gray-100/50 text-sm"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => {
                            handleDelete(agent);
                            setRowMenuOpenId(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-red-100 dark:hover:bg-red-800/60 text-sm text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal */}
      <CreateAgentModal open={createModalOpen} agents={agents} onOpenChange={onCreateModalOpenChange} />
    </>
  );
}
