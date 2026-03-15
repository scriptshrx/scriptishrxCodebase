"use client";

import { useState, useEffect } from 'react';
import {
  Stethoscope,
  Phone,
  LayoutList,
  Users,
  CreditCard,
  Key,
  Globe,
  PhoneIncoming,
  Brain
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import VoiceAgentsView from '@/components/voice/VoiceAgentsView';
import PhoneNumbersView from '@/components/voice/PhoneNumbersView';
import KnowledgeResourcesView from '@/components/voice/KnowledgeResourcesView';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/zustand';


// types

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

export default function VoicePage() {
  const router = useRouter();
  const store = useStore();

  // dark mode state based on system preferences
  const [darkMode, setDarkMode] = useState<boolean>(false);

  const applyDark = (enabled: boolean) => {
    const html = document.documentElement;
    if (enabled) html.classList.add('dark');
    else html.classList.remove('dark');
  };

  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(m.matches);
    applyDark(m.matches);
    const listener = (e: MediaQueryListEvent) => {
      setDarkMode(e.matches);
      applyDark(e.matches);
    };
    m.addEventListener('change', listener);
    return () => m.removeEventListener('change', listener);
  }, []);

  
  const [tenant, setTenant] = useState<{ name: string; email?: string } | null>(null);
  const [user, setUser] = useState<any>({});

  const fetchAgents = async () => {
    store.setLoading(true);
    store.setError(null);
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
      store.setAgents(list);
      store.setLoading(false);
    } catch (e: any) {
      console.error('[fetchAgents] Error:', e);
      const errorMsg = e?.message || String(e);
      store.setLoading(false);
      store.setError(errorMsg);
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
    <div className="flex min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
      {/* sidebar (same as befoe) */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between dark:bg-gray-800 dark:border-gray-700">
        <div>
          <div className="p-6 flex items-center gap-2 text-xl font-bold">
            <img src={'/newLogo.png'} className="w-12 h-12 rounded-lg shadow-md text-blue-600" />
            <span>Scriptish</span>
          </div>
         
          <nav className="px-4 space-y-1">
            {[
              { name: 'Voice Agents', icon: LayoutList },
              { name: 'Phone Numbers', icon: Phone },
              { name: 'Knowledge Resources', icon: Brain },
              { name: 'Call Logs', icon: PhoneIncoming },
              { name: 'Patients', icon: Users },
              { name: 'Billing', icon: CreditCard },
              { name: 'API Keys', icon: Key },
              { name: 'Webhooks', icon: Globe }
            ].map(item => {
              const Icon = item.icon;
              const isActive = store.selectedVoicePage === item.name;
              return (
                <button
                  type='button'
                  onClick={() => setSelectSideBar(item.name)}
                  key={item.name}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition ${
                    isActive ? 'bg-blue-100 font-semibold dark:bg-blue-800' : 'hover:bg-blue-100 dark:hover:bg-blue-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm truncate">{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="p-6 space-y-4 border-t border-gray-200">
          <div className="bg-green-100/70 p-3 dark:bg-gray-600/50 rounded-lg text-xs">
            <div className="font-semibold text-green-600 dark:text-green-500">Pay As You Go</div>
            <div className="text-green-600/80">No upcoming bill</div>
          </div>
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium">
              {tenant ? tenant.name.charAt(0).toUpperCase() : 'T'}
            </div>
            <span className="text-sm truncate">{tenant?.email || '—'}</span>
          </div>
        </div>
      </aside>

      {/* main section */}
      {store.selectedVoicePage === 'Voice Agents' && (
        <VoiceAgentsView />
      )}
      {store.selectedVoicePage === 'Phone Numbers' && (
        <PhoneNumbersView />
      )}
      {store.selectedVoicePage === 'Knowledge Resources' && (
        <KnowledgeResourcesView />
      )}

      {/* Edit/AssignPhone Modal */}
      {store.modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">
              {store.modalMode === 'edit' && 'Edit Voice Agent'}
              {store.modalMode === 'assignPhone' && 'Assign Phone'}
            </h2>
            {store.modalMode === 'assignPhone' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-800">Phone Number</label>
                  <Input
                    value={store.modalAgent?.phoneNumber || ''}
                    onChange={e => store.setModalAgent({ ...store.modalAgent, phoneNumber: e.target.value })}
                    placeholder="+1 234 567 8900"
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={store.closeModal}>Cancel</Button>
                  <Button onClick={() => store.handleSave(store.modalAgent, store.modalMode, apiFetch, router, fetchAgents)}>Save</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-800">Agent Name</label>
                  <Input
                    value={store.modalAgent?.name || ''}
                    onChange={e => store.setModalAgent({ ...store.modalAgent, name: e.target.value })}
                    placeholder="Front Desk Bot"
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-800">Agent Type</label>
                    <select
                      value={store.modalAgent?.agentType}
                      onChange={e => store.setModalAgent({ ...store.modalAgent, agentType: e.target.value as AgentType })}
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
                      value={store.modalAgent?.agentConfig?.voice?.voice_id || ''}
                      onChange={e => store.setModalAgent({
                        ...store.modalAgent,
                        agentConfig: {
                          ...store.modalAgent.agentConfig,
                          voice: {
                            ...(store.modalAgent.agentConfig?.voice || {}),
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
                    value={store.modalAgent?.provider || 'retell'}
                    onChange={e => store.setModalAgent({ ...store.modalAgent, provider: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-gray-900 text-sm"
                  >
                    <option value="retell">Retell</option>
                    <option value="twilio">Twilio</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                {store.modalAgent?.agentType === 'Single Prompt' && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-800">Prompt</label>
                    <textarea
                      value={store.modalAgent?.agentConfig?.prompt?.system_prompt || ''}
                      onChange={e => store.setModalAgent({
                        ...store.modalAgent,
                        agentConfig: {
                          ...store.modalAgent.agentConfig,
                          prompt: { ...store.modalAgent.agentConfig.prompt, system_prompt: e.target.value },
                        },
                      })}
                      className="w-full min-h-[100px] p-3 border border-gray-300 rounded-xl text-gray-900"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={store.closeModal}>Cancel</Button>
                  <Button onClick={() => store.handleSave(store.modalAgent, store.modalMode, apiFetch, router, fetchAgents)}>Save</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

