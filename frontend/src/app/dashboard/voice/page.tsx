"use client";

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Stethoscope,
  Bot,
  Phone,
  LayoutList,
  Users,
  CreditCard,
  Key,
  Globe,
  ChevronDown,
  MoreVertical,
  Search as SearchIcon,
  Plus,
  PhoneIncoming
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import CreateAgentModal from '@/components/voice/CreateAgentModal';

// types g

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

// api helper
const API_BASE = 'https://scriptshrxcodebase.onrender.com/api';

async function apiFetch(path: string, opts: any = {}) {
  const headers: any = {
    'Content-Type': 'application/json',
    ...opts.headers
  };

  // Get auth token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
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
      err = { error: errText || `HTTP ${res.status}` };
    }
    throw new Error(err.error || `Request failed with status ${res.status}`);
  }
  
  const data = await res.json();
  console.log('[apiFetch] Success response:', data);
  return data;
}

export default function VoicePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  // tenant details
  const [tenant, setTenant] = useState<{ name: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>({}); // typed loosely to avoid missing property errors
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'Newest' | 'Oldest'>('Newest');

  // modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'edit' | 'assignPhone' | null>(null);
  const [modalAgent, setModalAgent] = useState<Partial<Agent> | null>(null);
  const [rowMenuOpenId, setRowMenuOpenId] = useState<string | null>(null);

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[fetchAgents] Starting fetch from:', `${API_BASE}/voice-agents`);
      const data = await apiFetch('/voice-agents');
      console.log('[fetchAgents] Raw response:', data);
      const list = (data.agents || []).map((a: any) => ({
        ...a,
        // ensure agentConfig exists
        agentConfig: a.agentConfig || {},
      }));
      console.log('[fetchAgents] Parsed agents:', list);
      setAgents(list);
    }
    catch(e: any){
      console.error('[fetchAgents] Error:', e);
      const errorMsg = e?.message || String(e);
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

  // actions
  const openCreateModal = () => {
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
  };

  const openEdit = (agent: Agent) => {
    setModalMode('edit');
    // ensure agentConfig exists so UI can read nested props
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
        // when editing, send agentConfig along with name and agentType
        const patchBody: any = { agentConfig: modalAgent.agentConfig };
        if (modalAgent.name) patchBody.name = modalAgent.name;
        if (modalAgent.agentType) patchBody.agentType = modalAgent.agentType;
        await apiFetch(`/api/voice-agents/${modalAgent.id}`, {
          method: 'PATCH',
          body: JSON.stringify(patchBody)
    
        });
      }
      await fetchAgents();
      closeModal();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`Delete agent '${agent.name}'?`)) return;
    try {
      await apiFetch(`/api/voice-agents/${agent.id}`, { method: 'DELETE' });
      await fetchAgents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDuplicate = async (agent: Agent) => {
    // remove id by destructuring, avoids TS delete issue
    const { id, ...rest } = agent as any;
    const copy = { ...rest, name: `${agent.name} (copy)` } as Partial<Agent>;
    try {
      await apiFetch('/api/voice-agents', { method: 'POST', body: JSON.stringify(copy) });
      await fetchAgents();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // render
  return (
    user?.email!=='ezehmark@gmail.com'?
    <div className='h-full w-full items-center justify-center bg-gray-300 flex'>
      <div className='flex items-center justify-center flex-col gap-4'>
        <div className='h-10 w-10 rounded-full border border-2 border-t-transparent animate-spin'></div>
          <div className='text-gray-900 font-bold text-xl'>Development Ongoing, Please Wait</div>
        </div>
      

    </div>
    :
    <div className="flex min-h-screen bg-gray-50 text-gray-800">
      {/* sidebar (same as before) */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between">
        <div>
          <div className="p-6 flex items-center gap-2 text-xl font-bold">
            <Stethoscope className="w-6 h-6 text-blue-600" />
            <span>ScriptishRx</span>
          </div>
          <div className="px-6 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">
              {tenant ? tenant.name.charAt(0).toUpperCase() : 'T'}
            </div>
            <span className="truncate">{tenant ? `${tenant.name}'s${'\n'}Workspace` : "Tenant's Workspace"}</span>
          </div>
          <nav className="px-4 space-y-1">
            {[
              { name: 'Voice Agents', icon: LayoutList, active: true },
              { name: 'Phone Numbers', icon: Phone },
              { name: 'Call Logs', icon: PhoneIncoming },
              { name: 'Patients', icon: Users },
              { name: 'Billing', icon: CreditCard },
              { name: 'API Keys', icon: Key },
              { name: 'Webhooks', icon: Globe }
            ].map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.name}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer ${
                    item.active ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm truncate">{item.name}</span>
                </div>
              );
            })}
          </nav>
        </div>
        <div className="p-6 space-y-4 border-t border-gray-200">
          <div className="bg-gray-100 p-3 rounded-lg text-xs">
            <div className="font-semibold">Pay As You Go</div>
            <div className="text-gray-600">Upcoming Invoice: $25.68</div>
          </div>
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium">
              {tenant ? tenant.name.charAt(0).toUpperCase() : 'T'}
            </div>
            <span className="text-sm truncate">{tenant?.email || '—'}</span>
          </div>
        </div>
      </aside>

      {/* main */}
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Voice Agents</h1>
            <p className="text-sm text-gray-500">Manage ScriptishRx voice agents</p>
          </div>
          <div className="relative">
            <Button onClick={openCreateModal} className="bg-gray-900 text-white">
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
              className="pl-10"
            />
            <SearchIcon className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          </div>
          <div>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as any)}
              className="h-10 px-3 rounded-md border border-gray-300 bg-white text-gray-700 text-sm"
            >
              <option>Newest</option>
              <option>Oldest</option>
            </select>
          </div>
        </div>

        {/* list */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
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
                  className="hover:bg-gray-50 cursor-pointer relative"
                >
                  <td className="px-6 py-4">
                    {agent.name}
                  </td>
                  <td className="px-6 py-4">
                    {agent.agentType}
                  </td>
                  <td className="px-6 py-4">
                    {agent.status}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(agent.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right relative">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setRowMenuOpenId(rowMenuOpenId === agent.id ? null : agent.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded-full"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {rowMenuOpenId === agent.id && (
                      <div className="absolute right-4 top-10 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        <button
                          onClick={() => openEdit(agent)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDuplicate(agent)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => handleDelete(agent)}
                          className="w-full text-left px-4 py-2 hover:bg-red-100 text-sm text-red-600"
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

      {/* modals */}
      <CreateAgentModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">
              {modalMode === 'edit' && 'Edit Voice Agent'}
              {modalMode === 'assignPhone' && 'Assign Phone'}
            </h2>
            {modalMode === 'assignPhone' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-800">Phone Number</label>
                  <Input
                    value={modalAgent?.phoneNumber || ''}
                    onChange={e => setModalAgent({ ...modalAgent, phoneNumber: e.target.value })}
                    placeholder="+1 234 567 8900"
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeModal}>Cancel</Button>
                  <Button onClick={handleSave}>Save</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-800">Agent Name</label>
                  <Input
                    value={modalAgent?.name || ''}
                    onChange={e => setModalAgent({ ...modalAgent, name: e.target.value })}
                    placeholder="Front Desk Bot"
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-800">Agent Type</label>
                    <select
                      value={modalAgent?.agentType}
                      onChange={e => setModalAgent({ ...modalAgent, agentType: e.target.value as AgentType })}
                      className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-gray-900 text-sm"
                    >
                      <option>Single Prompt</option>
                      <option>Multi Prompt</option>
                      <option>Custom LLM</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-800">Voice ID</label>
                    <Input
                      value={modalAgent?.agentConfig?.voice?.voice_id || ''}
                      onChange={e => setModalAgent({
                        ...modalAgent,
                        agentConfig: {
                          ...modalAgent.agentConfig,
                          voice: {
                            ...(modalAgent.agentConfig?.voice || {}),
                            voice_id: e.target.value,
                          },
                        },
                      })}
                      placeholder="myra, jenny, etc."
                      className="bg-white border-gray-300 text-gray-900"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-800">Provider</label>
                  <select
                    value={modalAgent?.provider || 'retell'}
                    onChange={e => setModalAgent({ ...modalAgent, provider: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-gray-900 text-sm"
                  >
                    <option value="retell">Retell</option>
                    <option value="twilio">Twilio</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                {modalAgent?.agentType === 'Single Prompt' && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-800">Prompt</label>
                    <textarea
                      value={modalAgent?.agentConfig?.prompt?.system_prompt || ''}
                      onChange={e => setModalAgent({
                        ...modalAgent,
                        agentConfig: {
                          ...modalAgent.agentConfig,
                          prompt: { ...modalAgent.agentConfig.prompt, system_prompt: e.target.value },
                        },
                      })}
                      className="w-full min-h-[100px] p-3 border border-gray-300 rounded-xl text-gray-900"
                    />
                  </div>
                )}
                {/* additional config fields could be added for multi/custom */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeModal}>Cancel</Button>
                  <Button onClick={handleSave}>Save</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

