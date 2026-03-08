"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search as SearchIcon,
  Trash2,
  AlertTriangle,
  Info,
  Phone,
  Bot,
  X,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const API_BASE = 'https://scriptshrxcodebase.onrender.com/api';

// Types
type WeightedBinding = {
  agentId: string;
  weight: number;
};

type PhoneNumberDetails = {
  id: string;
  tenantId: string;
  nickname: string | null;
  phoneNumber: string;
  provider?: string | null;
  status?: string | null;
  
  inboundAgents: WeightedBinding[];
  outboundAgents: WeightedBinding[];
  inboundWebhookUrl?: string | null;

  createdAt: string;
  updatedAt: string;
};

type VoiceAgentOption = {
  id: string;
  name: string;
  mode?: string;
  agentType?: string;
  status?: string;
};

// API Helper
async function apiFetch(path: string, opts: any = {}) {
  const headers: any = {
    'Content-Type': 'application/json',
    ...opts.headers
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    credentials: 'include',
    ...opts,
    headers
  });

  if (!res.ok) {
    const errText = await res.text();
    let err: any = {};
    try {
      err = JSON.parse(errText);
    } catch {
      err = { error: errText || `HTTP ${res.status}` };
    }
    throw new Error(err.error || `Request failed with status ${res.status}`);
  }

  return await res.json();
}

// Sub-components

const NumberRow = ({
  number,
  selected,
  onClick
}: {
  number: PhoneNumberDetails;
  selected: boolean;
  onClick: () => void;
}) => (
  <div
    onClick={onClick}
    className={`p-4 border-l-4 cursor-pointer transition ${
      selected
        ? 'border-l-blue-600 bg-blue-50 dark:bg-blue-800/50'
        : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-700'
    }`}
  >
    <div className="font-semibold text-md text-gray-900 dark:text-gray-200">
      {number.nickname || 'Unnamed Number'}
    </div>
    <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{number.phoneNumber}</div>
    <div className="flex gap-2 mt-2">
      {number.provider && (
        <span className="px-2 py-0.5 bg-gray-200 text-xs rounded text-gray-700 dark:text-gray-800">
          {number.provider}
        </span>
      )}
      {number.status && (
        <span className={`px-2 py-0.5 text-xs rounded ${
          number.status === 'active'
            ? 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200'
            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200'
        }`}>
          {number.status}
        </span>
      )}
    </div>
  </div>
);

const BindingRow = ({
  binding,
  agents,
  onAgentChange,
  onWeightChange,
  onRemove,
  showError
}: {
  binding: WeightedBinding;
  agents: VoiceAgentOption[];
  onAgentChange: (agentId: string) => void;
  onWeightChange: (weight: number) => void;
  onRemove: () => void;
  showError: boolean;
}) => {
  const agentName = agents.find(a => a.id === binding.agentId)?.name || 'Select agent';

  return (
    <div className="flex gap-3 items-end">
      <select
        value={binding.agentId}
        onChange={e => onAgentChange(e.target.value)}
        className={`flex-1 h-10 px-3 rounded-md border text-sm bg-white dark:bg-gray-200 text-gray-900 ${
          showError ? 'border-red-300' : 'border-gray-300'
        }`}
      >
        <option value="">Select agent</option>
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
      <div className="w-20">
        <input
          type="number"
          value={binding.weight}
          onChange={e => onWeightChange(Math.max(1, parseInt(e.target.value) || 0))}
          className={`w-full h-10 px-3 rounded-md border text-sm text-gray-900 dark:text-gray-300 ${
            showError ? 'border-red-300' : 'border-gray-300'
          }`}
          min="1"
        />
      </div>
      <button
        onClick={onRemove}
        className="p-2 hover:bg-red-50 dark:hover:bg-red-800 rounded-md text-red-600"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

const CountryTagInput = ({
  countries,
  onChange
}: {
  countries: string[];
  onChange: (countries: string[]) => void;
}) => {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      const code = input.trim().toUpperCase();
      if (!countries.includes(code)) {
        onChange([...countries, code]);
      }
      setInput('');
    }
  };

  const removeCountry = (code: string) => {
    onChange(countries.filter(c => c !== code));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {countries.map(code => (
          <div
            key={code}
            className="bg-gray-200 text-gray-900 px-3 py-1 rounded text-sm flex items-center gap-2 dark:bg-gray-700 dark:text-gray-200"
          >
            {code}
            <button
              onClick={() => removeCountry(code)}
              className="hover:text-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter country code (e.g., US) and press Enter"
        className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm text-gray-900"
      />
    </div>
  );
};

const ConnectPhoneProviderModal = ({
  open,
  onOpenChange,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
}) => {
  const [formData, setFormData] = useState({
    phoneNumber: '',
    provider: '',
    nickname: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const PROVIDERS = ['Twilio', 'Vonage', 'Bandwidth', 'AWS Pinpoint', 'Other'];

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Required';
    if (!formData.provider.trim()) newErrors.provider = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
      setFormData({
        phoneNumber: '',
        provider: '',
        nickname: ''
      });
      setErrors({});
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 dark:bg-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Add Phone Number</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-800 block mb-2">
              Phone Number *
            </label>
            <input
              type="text"
              value={formData.phoneNumber}
              onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
              placeholder="Enter phone number (e.g., +15551234567)"
              className={`w-full h-10 px-3 rounded-md border text-gray-900 text-sm ${
                errors.phoneNumber ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.phoneNumber && (
              <p className="text-red-600 text-xs mt-1">{errors.phoneNumber}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-800 block mb-2">
              Provider *
            </label>
            <select
              value={formData.provider}
              onChange={e => setFormData({ ...formData, provider: e.target.value })}
              className={`w-full h-10 px-3 rounded-md border text-gray-900 text-sm bg-white ${
                errors.provider ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">Select a provider</option>
              {PROVIDERS.map(provider => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
            {errors.provider && (
              <p className="text-red-600 text-xs mt-1">{errors.provider}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-800 block mb-2">
              Nickname (Optional)
            </label>
            <input
              type="text"
              value={formData.nickname}
              onChange={e => setFormData({ ...formData, nickname: e.target.value })}
              placeholder="Enter a nickname for this number"
              className="w-full h-10 px-3 rounded-md border border-gray-300 text-gray-900 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Add Number
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main Component
type PhoneNumbersViewProps = {
  createModalOpen: boolean;
  onCreateModalOpenChange: (open: boolean) => void;
};

export default function PhoneNumbersView({
  createModalOpen,
  onCreateModalOpenChange
}: PhoneNumbersViewProps) {
  const [numbersList, setNumbersList] = useState<PhoneNumberDetails[]>([]);
  const [selectedNumberId, setSelectedNumberId] = useState<string | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<PhoneNumberDetails | null>(null);
  const [agents, setAgents] = useState<VoiceAgentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddNumber, setShowAddNumber] = useState(false);
  const [sipLoading, setSipLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<PhoneNumberDetails> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Fetch phone numbers list
  const fetchNumbers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/phone-numbers');
      setNumbersList(data.numbers || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch agents for dropdown
  const fetchAgents = async () => {
    try {
      const data = await apiFetch('/voice-agents');
      setAgents(data.agents || []);
    } catch (err: any) {
      console.error('Failed to fetch agents:', err);
    }
  };

  // Fetch selected number details
  const fetchNumberDetails = async (id: string) => {
    try {
      const data = await apiFetch(`/phone-numbers/${id}`);
      setSelectedNumber(data);
      setFormData(data);
      setDirty(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchNumbers();
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedNumberId) {
      fetchNumberDetails(selectedNumberId);
    }
  }, [selectedNumberId]);

  const filteredNumbers = useMemo(() => {
    if (!searchQuery) return numbersList;
    const q = searchQuery.toLowerCase();
    return numbersList.filter(
      n => n.nickname?.toLowerCase().includes(q) || n.phoneNumber.includes(q)
    );
  }, [numbersList, searchQuery]);

  const handleSaveNumber = async () => {
    if (!selectedNumber || !formData) return;

    // Validate
    const inboundTotal = (formData.inboundAgents || []).reduce((sum, b) => sum + b.weight, 0);
    const outboundTotal = (formData.outboundAgents || []).reduce((sum, b) => sum + b.weight, 0);

    if (formData.inboundAgents && formData.inboundAgents.length > 1 && inboundTotal !== 100) {
      alert('Inbound agents total weight must equal 100');
      return;
    }

    if (formData.outboundAgents && formData.outboundAgents.length > 1 && outboundTotal !== 100) {
      alert('Outbound agents total weight must equal 100');
      return;
    }

    if ((formData.inboundWebhookUrl || '').trim() && !isValidUrl(formData.inboundWebhookUrl)) {
      alert('Invalid webhook URL');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        phoneNumber: formData.phoneNumber,
        provider: formData.provider,
        nickname: formData.nickname,
        inboundAgents: formData.inboundAgents,
        outboundAgents: formData.outboundAgents,
        inboundWebhookUrl: formData.inboundWebhookUrl,

      };

      let result;
      if (isCreatingNew) {
        // Create new phone number
        result = await apiFetch('/phone-numbers', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setIsCreatingNew(false);
      } else {
        // Update existing phone numbers
        await apiFetch(`/phone-numbers/${selectedNumber.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        result = { id: selectedNumber.id };
      }

      setDirty(false);
      await fetchNumbers();
      if (result.id) {
        await fetchNumberDetails(result.id);
        setSelectedNumberId(result.id);
      }
      alert('Saved successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhoneNumber = (data: any) => {
    // Create a new phone number object without saving to DB yet
    const newPhoneNumber: Partial<PhoneNumberDetails> = {
      phoneNumber: data.phoneNumber,
      provider: data.provider,
      nickname: data.nickname,
      inboundAgents: [],
      outboundAgents: [],
      
    };
    
    setFormData(newPhoneNumber);
    setSelectedNumber(newPhoneNumber as PhoneNumberDetails);
    setSelectedNumberId(null); // No ID yet since it's not saved
    setIsCreatingNew(true);
    setDirty(true);
    setShowAddNumber(false);
  };

  const addBinding = (type: 'inbound' | 'outbound') => {
    if (!formData) return;
    const key = type === 'inbound' ? 'inboundAgents' : 'outboundAgents';
    const updated = [...(formData[key as keyof typeof formData] as WeightedBinding[] || [])];
    updated.push({ agentId: '', weight: 100 });
    console.log('Updated binding [weightBinding]:',updated);
    setFormData({ ...formData, [key]: updated });
    setDirty(true);
  };

  const updateBinding = (
    type: 'inbound' | 'outbound',
    index: number,
    binding: WeightedBinding
  ) => {
    if (!formData) return;
    const key = type === 'inbound' ? 'inboundAgents' : 'outboundAgents';
    const updated = [...((formData[key as keyof typeof formData] as WeightedBinding[]) || [])];
    updated[index] = binding;
    setFormData({ ...formData, [key]: updated });
    setDirty(true);
  };

  const removeBinding = (type: 'inbound' | 'outbound', index: number) => {
    if (!formData) return;
    const key = type === 'inbound' ? 'inboundAgents' : 'outboundAgents';
    const updated = [...((formData[key as keyof typeof formData] as WeightedBinding[]) || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, [key]: updated });
    setDirty(true);
  };

  return (
    <main className="flex-1 flex bg-gray-50 dark:bg-gray-900 dark:text-gray-100">
      {/* Left Column */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col dark:bg-gray-800 dark:border-gray-700">
        <div>
        <div className="p-4 mb-2 border-b justify-between gap-2 items-center flex border-gray-200">

          <h2 className="text-md font-bold mb-4 my-auto">{formData?.phoneNumber || 'Add New Number'}</h2>
           <button onClick={()=>setShowAddNumber(true)}
           type='button' 
           className="px-2 py-[8px] cursor-pointer bg-gray-800 dark:bg-gray-300 hover:bg-gray-900 text-white hover:text-white dark:text-gray-900 rounded-lg flex items-center gap-2">
                  <Plus className="w-4 h-4 text-gray-200 dark:text-gray-900 hover:text-white/90" />
                  Add
                </button>
          </div>
          <div className="relative">
            <Input
              placeholder="Search numbers"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 text-gray-800 mx-auto placeholder:text-gray-800 dark:placeholder:text-gray-400 dark:text-gray-300 border w-[90%] border-gray-400 shadow-md"
            />
           
          
           <SearchIcon className="absolute left-6 top-3 w-4 h-4 text-gray-400" />
        </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : filteredNumbers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              You don't have any phone numbers
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredNumbers.map(number => (
                <NumberRow
                  key={number.id}
                  number={number}
                  selected={selectedNumberId === number.id}
                  onClick={() => setSelectedNumberId(number.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column */}
      <div className="flex-1 overflow-y-auto p-8">
        {!selectedNumber ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <Phone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Select a phone number to configure bindings</p>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold">Phone Number Settings</h1>
              <div className="relative">
        
              
              </div>
            </div>

            {/* Overview Section */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4 dark:text-gray-100">Overview</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 block mb-2">
                    Nickname
                  </label>
                  <Input
                    value={formData?.nickname || ''}
                    onChange={e => {
                      setFormData({ ...formData, nickname: e.target.value });
                      setDirty(true);
                    }}
                    placeholder="Enter nickname"
                    className="text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 block mb-2">
                    Phone Number
                  </label>
                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 text-sm">
                    {formData?.phoneNumber}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 block mb-2">
                    Provider
                  </label>
                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 text-sm">
                    {formData?.provider || 'N/A'}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 block mb-2">
                    Status
                  </label>
                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 text-sm capitalize">
                    {formData?.status || 'Active'}
                  </div>
                </div>
              </div>
            </div>

            {/* Inbound Agents Section */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-2 dark:text-gray-100">Inbound Voice Agents</h3>
              <p className="text-sm text-gray-600 mb-4 dark:text-gray-300">
                Inbound agents answer calls to this number.
              </p>

              <div className="space-y-3 mb-4">
                {!formData?.inboundAgents || formData.inboundAgents.length === 0 ? (
                  <p className="text-sm text-gray-500">No inbound agent assigned.</p>
                ) : (
                  <>
                    {formData.inboundAgents.map((binding, idx) => (
                      <BindingRow
                        key={idx}
                        binding={binding}
                        agents={agents}
                        onAgentChange={agentId => {
                          updateBinding('inbound', idx, { ...binding, agentId });
                        }}
                        onWeightChange={weight => {
                          updateBinding('inbound', idx, { ...binding, weight });
                        }}
                        onRemove={() => removeBinding('inbound', idx)}
                        showError={false}
                      />
                    ))}
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-600 dark:text-gray-300">Total weight:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-300">
                        {formData.inboundAgents.reduce((sum, b) => sum + b.weight, 0)}
                      </span>
                    </div>
                    {formData.inboundAgents.length > 1 &&
                      formData.inboundAgents.reduce((sum, b) => sum + b.weight, 0) !== 100 && (
                        <div className="flex gap-2 p-3 bg-yellow-50 rounded border border-yellow-200">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-yellow-700">
                            Total weight must equal 100 when multiple agents exist.
                          </p>
                        </div>
                      )}
                  </>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => addBinding('inbound')}
                className="w-full dark:text-gray-400 dark:hover:bg-gray-200/50"
              >
                <Bot className="w-4 h-4 mr-2 dark:text-gray-300" />
                Add Inbound Agent
              </Button>
            </div>

            {/* Outbound Agents Section */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-2 dark:text-gray-100">Outbound Voice Agents</h3>
              <p className="text-sm text-gray-600 mb-4 dark:text-gray-300">
                Outbound agents are used when this number places calls.
              </p>

              <div className="space-y-3 mb-4">
                {!formData?.outboundAgents || formData.outboundAgents.length === 0 ? (
                  <p className="text-sm text-gray-500">No outbound agent assigned.</p>
                ) : (
                  <>
                    {formData.outboundAgents.map((binding, idx) => (
                      <BindingRow
                        key={idx}
                        binding={binding}
                        agents={agents}
                        onAgentChange={agentId => {
                          updateBinding('outbound', idx, { ...binding, agentId });
                        }}
                        onWeightChange={weight => {
                          updateBinding('outbound', idx, { ...binding, weight });
                        }}
                        onRemove={() => removeBinding('outbound', idx)}
                        showError={false}
                      />
                    ))}
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-600 dark:text-gray-300">Total weight:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-300">
                        {formData.outboundAgents.reduce((sum, b) => sum + b.weight, 0)}
                      </span>
                    </div>
                    {formData.outboundAgents.length > 1 &&
                      formData.outboundAgents.reduce((sum, b) => sum + b.weight, 0) !== 100 && (
                        <div className="flex gap-2 p-3 bg-yellow-50 rounded border border-yellow-200">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-yellow-700">
                            Total weight must equal 100 when multiple agents exist.
                          </p>
                        </div>
                      )}
                  </>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => addBinding('outbound')}
                className="w-full dark:text-gray-400 dark:hover:bg-gray-200/50"
              >
                <Bot className="w-4 h-4 mr-2 dark:text-gray-300" />
                Add Outbound Agent
              </Button>
            </div>

            {/* Advanced Section */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4 dark:text-gray-100">Advanced</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 block mb-2">
                    Inbound Webhook URL
                  </label>
                  <Input
                    value={formData?.inboundWebhookUrl || ''}
                    readOnly
                    
                    onChange={e => {
                      setFormData({ ...formData, inboundWebhookUrl: e.target.value });
                      setDirty(true);
                    }}
                    placeholder="https://scriptishrx.net/incomimg"
                    className="text-gray-900 dark:text-gray-100 border-gray-700 dark:border-gray-600 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  />
                </div>
              
              </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-2 pt-6">
              <Button
                onClick={handleSaveNumber}
                disabled={!dirty || saving}
                className="flex items-center gap-2"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Phone Provider Modal */}
      <ConnectPhoneProviderModal
        open={showAddNumber}
        onOpenChange={setShowAddNumber}
        onSave={handleAddPhoneNumber}
      />
    </main>
  );
}

// Helper function
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
