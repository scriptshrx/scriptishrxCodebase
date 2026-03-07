"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Pencil,
  Mic,
  Zap,
  Code,
  PhoneCall,
  FileText,
  Shield,
  Link as LinkIcon,
  Play,
  Codepen,
  PhoneOutgoing,
  MessageCircle,
  AudioWaveform,
  BrainCircuit
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

// Force dynamic rendering to prevent prerender errors with client-only hooks
export const dynamic = "force-dynamic";

const API_BASE = "https://scriptshrxcodebase.onrender.com";

// Get tenant ID from locaLStorage (stored during login/registration)
function getTenantId(): string {
  if (typeof window === "undefined") return "";
  const userString = localStorage.getItem("user");
  if (!userString) return "";
  try {
    const user = JSON.parse(userString);
    return user.tenantId;
  } catch {
    return "";
  }
}

async function apiFetch(path: string, opts: any = {}) {
  const tenantId = getTenantId();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: any = {
    "Content-Type": "application/json",
    "x-tenant-id": tenantId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...opts,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

function SinglePromptAgentContent({ template }: { template: "blank" | "healthcare_checkin" | "notification" }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  // core fields
  const [agentId, setAgentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [welcomeMode, setWelcomeMode] = useState("ai");
  const [llmModel, setLlmModel] = useState("GPT-4o");
  // voiceId represents agentConfig.voice.voice_id
  const [voiceId, setVoiceId] = useState("Myra");
  const [language, setLanguage] = useState("English");
  // dynamic variables detected in prompt ({{var}} syntax)
  const [dynamicVariables, setDynamicVariables] = useState<string[]>([]);

  const [showTitleInput, setShowTitleInput] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // settings panel
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [functionsList, setFunctionsList] = useState<any[]>([]);
  const [speechSettings, setSpeechSettings] = useState({ speed: 50, sensitivity: 50 });
  const [callSettings, setCallSettings] = useState({ silenceTimeout: 5, maxDuration: 10 });
  const [postCall, setPostCall] = useState({ enableSummaries: false });
  const [security, setSecurity] = useState({ piiRedaction: false });
  const[buttonChoice, setButtonChoice]=useState('test-call')




  const [webhookUrl, setWebhookUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
 if(window && typeof window !== undefined){
  const item = localStorage.getItem('template');
  if(item){
    const template = JSON.parse(item)
    if(item.title){
      setName(item.id);
      setWelcomeMessage(item.subtitle);
      setPrompt(item.description);
      return
    }
    setAgentId(template.id);
  setName(template.name);
  setCallSettings(template.agentConfig.call_settings);
  setLanguage(template.agentConfig.speech.language);
  setLlmModel(template.agentConfig.llm.model);
  setPrompt(template.agentConfig.prompt.system_prompt);
  setWelcomeMessage(template.agentConfig.prompt.welcome_message);
  setDynamicVariables(template.agentConfig.dynamic_variables);
  setFunctionsList(template.agentConfig.functions);
  setSpeechSettings(template.agentConfig.speech);
  setVoiceId(template.agentConfig.voice.voice_id);
 

  }
 }
  }, []);

  useEffect(() => {
    if (showTitleInput && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [showTitleInput]);

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      // construct agentConfig object according to spec
      const agentConfig: any = {
        prompt: {
          system_prompt: prompt,
          welcome_message: welcomeMessage,
        },
        voice: {
          provider: "elevenlabs",
          voice_id: voiceId,
          speed: 1,
        },
        llm: {
          provider: "openai",
          model: llmModel,
          temperature: 0.2,
        },
        speech: {
          stt_provider: "deepgram",
          model: "nova-2",
          language,
        },
        call_settings: {
          max_call_duration_seconds: callSettings.maxDuration * 60,
          silence_timeout_seconds: callSettings.silenceTimeout,
          interruption_sensitivity: speechSettings.sensitivity / 100,
        },
        functions: functionsList,
        webhooks: { url: webhookUrl },
        dynamic_variables: dynamicVariables,
      };

      const body = {
        agentType: "Single Prompt",
        mode: "single",
        name,
        template,
        agentConfig,
      };
      const res = await apiFetch(`/api/voice-agents`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setAgentId(res.agent.id);
      router.push(`/voice/${res.agent.id}/single-prompt`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!agentId) return;
    setSaving(true);
    setError("");
    try {
      // build updated agentConfig
      const agentConfig: any = {
        prompt: {
          system_prompt: prompt,
          welcome_message: welcomeMessage,
        },
        voice: {
          provider: "elevenlabs",
          voice_id: voiceId,
          speed: 1,
        },
        llm: {
          provider: "openai",
          model: llmModel,
          temperature: 0.2,
        },
        speech: {
          stt_provider: "deepgram",
          model: "nova-2",
          language,
        },
        call_settings: {
          max_call_duration_seconds: callSettings.maxDuration * 60,
          silence_timeout_seconds: callSettings.silenceTimeout,
          interruption_sensitivity: speechSettings.sensitivity / 100,
        },
        functions: functionsList,
        webhooks: { url: webhookUrl },
        dynamic_variables: dynamicVariables,
      };
      const body: any = { agentConfig };
      await apiFetch(`/api/voice-agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      // optionally toast success
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!agentId) return;
    try {
      await apiFetch(`/api/voice-agents/${agentId}/test`, { method: "POST" });
      alert("Test successful");
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return <div className="p-10 text-center">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <header className="sticky top-0 right-0 bg-white z-20 flex items-center justify-between px-6 py-3 shadow-sm border-b border-gray-200">
        <button
          onClick={() => router.back()}
          className="p-2 rounded hover:bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex flex-col mx-4">
          <div className="flex items-center gap-2">
            {showTitleInput ? (
              <Input
                ref={titleInputRef}
                value={name}
                onKeyDown={(e)=>{if(e.key==='Enter')setShowTitleInput(false)}}
                onChange={(e) => {setName(e.target.value);
              
                }}
                onBlur={() => setShowTitleInput(false)}
                className="w-full p-0 border-0 text-[24px] text-gray-900"
              />
            ) : (
              <h1 className="text-xl font-bold truncate">{name}</h1>
            )}
            <button
              onClick={() => setShowTitleInput((s) => !s)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm text-gray-500">
            Single prompt • Agent ID: {agentId || "Not created yet"}
          </div>
        </div>
        <div className="flex-col flex md:flex-row items-center gap-2">
          <Select
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            options={[
              { value: "GPT-4o", label: "GPT-4o" },
              { value: "GPT-4o-mini", label: "GPT-4o-mini" },
              { value: "GPT-3.5", label: "GPT-3.5" },
            ]}
            className="h-8"
          />
          <Select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            options={[
              { value: "Markkio", label: "Markkio" },
              { value: "Jenny", label: "Jenny" },
              { value: "Gillian", label: "Gillian" },
              { value: "Default", label: "Default" },
            ]}
            className="h-8"
          />
          <Select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            options={[
              { value: "English", label: "English" },
              { value: "Spanish", label: "Spanish" },
            ]}
            className="h-8"
          />
         
          <Button
            variant="primary"
            size="default"
            disabled={saving}
            onClick={agentId ? handleSave : handleCreate}
          >
            {agentId ? "Save" : "Create"}
          </Button>
        </div>
      </header>

      <div className="flex flex-col w-full md:flex-row h-full overflow-hidden">
        {/* left column */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-4">
            <textarea
              value={prompt}
              onChange={(e) => {
                const val = e.target.value;
                setPrompt(val);
                // detect dynamic variables
                const matches = Array.from(val.matchAll(/\{\{(.*?)\}\}/g)).map(m => m[1]);
                setDynamicVariables(Array.from(new Set(matches)));
              }}
              placeholder="Type in a universal prompt for your agent, such as its role, conversational style, objective, etc."
              className="w-full h-64 p-4 border border-gray-300 rounded shadow-sm font-mono resize-none focus:outline-none"
            />
            {dynamicVariables.length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                Detected variables: {dynamicVariables.join(", ")}
              </div>
            )}
            <p className="text-xs text-gray-500">
              {'Use {{}} to add variables. (Learn more)'}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                Welcome Message
              </label>
              <Select
                value={welcomeMode}
                onChange={(e) => setWelcomeMode(e.target.value)}
                options={[
                  { value: "ai", label: "AI Initiates: AI begins with your defined begin message." },
                ]}
                className="w-full h-8"
              />
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                className="w-full h-24 p-3 border border-gray-300 rounded resize-none focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* middle column settings list */}
        <div className="w-full md:w-80 border-l border-r rounded-md shadow-md border-gray-200 overflow-y-auto">
          <nav className="space-y-1 p-4">
            {[
              { name: "Functions", icon: Code, key: "functions" },

              { name: "Speech Settings", icon: AudioWaveform, key: "speech" },
              { name: "Call Settings", icon: PhoneCall, key: "call" },
              {name:'Knowledge Resources',icon :BrainCircuit, key:'brain'},
              { name: "Post-Call Analysis", icon: FileText, key: "post" },
              { name: "Security Settings", icon: Shield, key: "security" },
              { name: "Webhook Settings", icon: LinkIcon, key: "webhook" },
            ].map((item) => (
              <div key={item.key}>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded"
                  onClick={() =>
                    setActivePanel((s) => (s === item.key ? null : item.key))
                  }
                >
                  <item.icon className="w-5 h-5 text-blue-600" />
                  <span className="flex-1 text-sm text-gray-800">
                    {item.name}
                  </span>
                </button>
                {activePanel === item.key && (
                  <div className="p-3 bg-gray-50">
                    {renderPanel(item.key)}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* right column testing panel */}
        <div className="w-full md:w-80 p-6 h-50 md:h-full overflow-y-auto">
          <div className="border h-80 rounded-lg p-4 flex justify-between flex-col items-center">
            <div className="flex gap-2 p-[2px] bg-gray-100 rounded-lg">
              <button onClick={()=>setButtonChoice('test-call')} className={`p-[4px] rounded-lg ${buttonChoice=='test-call'?'bg-slate-600 text-white':'bg-white text-gray-700'} font-medium text-[12px] px-[8px] flex items-center gap-1 transition-colors`}>
                <PhoneOutgoing className="w-3 h-3" />
                Test Call
              </button>
               <button onClick={()=>setButtonChoice('test-chat')} className={`p-[4px] rounded-lg ${buttonChoice=='test-chat'?'bg-slate-600 text-white':'bg-white text-gray-700'} font-medium text-[12px] px-[8px] flex items-center gap-1 transition-colors`}>
                <MessageCircle className="w-3 h-3" />
                Test Chat
              </button>
              <button className="p-[4px] flex items-center justify-center rounded-lg bg-white text-gray-700">
                <Codepen className="w-4 h-4" />
              </button>
            </div>
            <Mic className="w-12 h-12 text-gray-400" />
            <div className="text-gray-600">Test your agent</div>
            <Button
              onClick={handleTest}
              disabled={!agentId}
              className="w-full"
            >
              Test
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="fixed top-20 left-20 p-4 bg-red-100 text-red-800">{error}</div>
      )}
    </div>
  );

  function renderPanel(key: string) {
    switch (key) {
      case "functions":
        return (
          <div className="space-y-2">
            {functionsList.map((f, i) => (
              <div key={i} className="flex items-center justify-between">
                <span>{f.name || "Unnamed"}</span>
                <button
                  onClick={() =>
                    setFunctionsList((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  x
                </button>
              </div>
            ))}
            <Button
              size="sm"
              onClick={() =>
                setFunctionsList((prev) => [...prev, { name: "" }])
              }
            >
              Add Function
            </Button>
          </div>
        );
      case "speech":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium">Voice speed</label>
            <input
  type="range"
  min={0}
  max={100}
  value={speechSettings.speed}
  onChange={(e) =>
    setSpeechSettings((s) => ({ ...s, speed: +e.target.value }))
  }
  style={{
    background: `linear-gradient(to right, #6b7280 ${speechSettings.speed}%, #e5e7eb ${speechSettings.speed}%)`
  }}
  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
/>
            </div>
            <div>
              <label className="text-xs font-medium">
                Interruption sensitivity
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={speechSettings.sensitivity}
                onChange={(e) =>
                  setSpeechSettings((s) => ({
                    ...s,
                    sensitivity: +e.target.value,
                  }))
                }
                style={{
                  background: `linear-gradient(to right, #6b7280 ${speechSettings.sensitivity}%, #e5e7eb ${speechSettings.sensitivity}%)`
                }}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        );
        case 'brain':
          return(<div className="flex items-center justify-center p-4 px-2">
        <Button variant="primary" size="default">Upload Files</Button>
          </div>);
      case "call":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium">Silence timeout (s)</label>
              <input
                type="number"
                value={callSettings.silenceTimeout}
                onChange={(e) =>
                  setCallSettings((c) => ({
                    ...c,
                    silenceTimeout: +e.target.value,
                  }))
                }
                className="w-full border rounded px-2"
              />
            </div>
            <div>
              <label className="text-xs font-medium">
                Max call duration (m)
              </label>
              <input
                type="number"
                value={callSettings.maxDuration}
                onChange={(e) =>
                  setCallSettings((c) => ({
                    ...c,
                    maxDuration: +e.target.value,
                  }))
                }
                className="w-full border rounded px-2"
              />
            </div>
          </div>
        );
      case "post":
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={postCall.enableSummaries}
              onChange={(e) =>
                setPostCall({ enableSummaries: e.target.checked })
              }
            />
            <span className="text-sm">Enable summaries</span>
          </div>
        );
      case "security":
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={security.piiRedaction}
              onChange={(e) =>
                setSecurity({ piiRedaction: e.target.checked })
              }
            />
            <span className="text-sm">Allow PII redaction</span>
          </div>
        );
      case "webhook":
        return (
          <div>
            <label className="text-xs font-medium">Webhook URL</label>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://example.com/hook"
              className="text-gray-600 border border-gray-400"
            />
          </div>
        );
      default:
        return null;
    }
  }
}

function SinglePromptAgentPageContent() {
  const searchParams = useSearchParams();
  const template = (searchParams.get("template") || "blank") as
    | "blank"
    | "healthcare_checkin"
    | "notification";

  return <SinglePromptAgentContent template={template} />;
}

export default function SinglePromptAgentPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <SinglePromptAgentPageContent />
    </Suspense>
  );
}
