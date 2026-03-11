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
  BrainCircuit,
  Bot
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
 //const[template,setTemplate]=useState({})

function SinglePromptAgentContent() {
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
  // each function has at least a `type` and optional `name`
  const [functionsList, setFunctionsList] = useState<any[]>([]);
  // modal open state for editing functions
  const [functionsModalOpen, setFunctionsModalOpen] = useState(false);

  // available built-in types (from screenshot)
  const functionOptions = [
    { value: 'end_call', label: 'End Call', icon:Bot },
    { value: 'call_transfer', label: 'Call Transfer' },
    { value: 'agent_transfer', label: 'Agent Transfer' },
    { value: 'check_calendar', label: 'Check Calendar Availability (Cal.com)' },
    { value: 'book_calendar', label: 'Book on the Calendar (Cal.com)' },
    
    { value: 'send_sms', label: 'Send SMS' },

    { value: 'custom', label: 'Custom Function' },
  ];
  const [speechSettings, setSpeechSettings] = useState({ speed: 50, sensitivity: 50 });
  const [callSettings, setCallSettings] = useState({ silenceTimeout: 5, maxDuration: 10 });
  const [postCall, setPostCall] = useState({ enableSummaries: false });
  const [security, setSecurity] = useState({ piiRedaction: false });
  const[buttonChoice, setButtonChoice]=useState('test-call')

  // modal state for function editor
  const [selectedFunction, setSelectedFunction] = useState<any>({});
  const [openSelectedFunction, setOpenSelectedFunction] = useState(false);
 




  const [webhookUrl, setWebhookUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
    useEffect(() => {
 if(window && typeof window !== undefined){
  const item = localStorage.getItem('template');
  if(item){
    const template = JSON.parse(item)
    if(template.id=='blank'){
      setName(template.id);
      setWelcomeMessage(template.subtitle);
      setPrompt(template.description);
      setLoading(false)
      return
    }
    
  setName(`${template.name}-Edit`);
  setCallSettings(template.agentConfig.call_settings);
  setLanguage(template.agentConfig.speech.language || 'English');
  setLlmModel(template.agentConfig.llm.model);
  setPrompt(template.agentConfig.prompt.system_prompt);
  setWelcomeMessage(template.agentConfig.prompt.welcome_message);
  setDynamicVariables(template.agentConfig.dynamic_variables);
  setFunctionsList(
    template.agentConfig.functions?.map((f: any) => ({
      type: f.type || f.name || '',
      name: f.name || ''
    })) || []
  );
  setSpeechSettings(template.agentConfig.speech);
  setVoiceId(template.agentConfig.voice.voice_id);
  setLoading(false)
 

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

  //functionsList Modal

  function FunctionsModal(){
    return(
      <div className="flex inset-0 w-full fixed p-8 bg-white/20 dark:bg-black/20 backdrop-blur-md items-center z-[100] justify-center"
      onClick={()=>setFunctionsModalOpen(false)}>

        <div className="shadow-md p-4 overflow-hidden overflow-y-auto rounded-lg flex flex-col gap-2 bg-gray-200 dark:bg-gray-900">
          {functionOptions.map((f,i)=>{
            const Icon = f.icon;


          return(
          <button type="button"
          key={i}
          onClick={(e)=>{e.stopPropagation();setSelectedFunction(f);setOpenSelectedFunction(true);setFunctionsModalOpen(false)}}
          className="p-2 px-2 rounded-md cursor-pointer flex border bg-gray-300 dark:bg-gray-800 border-gray-100 hover:text-blue-500 dark:border-gray-700 hover:bg-blue-100/50 dark:border-gray-700">
            {f.icon&&<Icon heigh={20} width={20} className='text-blue-600 mr-2'/>} {f.label}</button>
          )})}
        </div>

        

      </div>
    )
  }

  // (hook declarations were moved above to avoid conditional rendering)

  const renderSelectedFunctionModal = (selectedFunction)=>{
    switch(selectedFunction.value || 'end_call'){
      case 'end_call':
        return(
          openSelectedFunction&&
            <div className="flex fixed inset-0 bg-white/50 backdrop-blur-md items-center z-[150] justify-center"
            onClick={()=>setOpenSelectedFunction(false)}>
          
        <div className="flex flex-col gap-2 p-4 rounded-lg mx-auto top-20 bg-white dark:bg-gray-900"
        onClick={(e)=>e.stopPropagation()}>
          <label htmlFor="name">Name</label>
          <input readOnly className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4"
          placeholder={selectedFunction.value}/>

    
          <label htmlFor="description">Description</label>
              <input id="description" 
              className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
          placeholder='Ends the call when done'/>
          <Button 
          variant='primary'
          onClick={()=>setOpenSelectedFunction(false)}>Done</Button>
</div>
</div>
        )
    }
    
  }

  
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
       {/* functions modal */}

        {functionsModalOpen&&
        <FunctionsModal/>}
        {renderSelectedFunctionModal(selectedFunction)}

      {/* headers */}
      <header className="sticky top-0 right-0 bg-white dark:bg-gray-800 z-20 flex items-center justify-between px-6 py-3 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => router.back()}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
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
                className="w-full p-0 border-0 text-[24px] text-gray-900 dark:text-gray-100"
              />
            ) : (
              <h1 className="text-xl font-bold truncate">{name}</h1>
            )}
            <button
              onClick={() => setShowTitleInput((s) => !s)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
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
              className="w-full h-64 p-4 border border-gray-300 dark:border-gray-600 rounded shadow-sm font-mono resize-none focus:outline-none bg-white dark:bg-gray-800 dark:text-gray-100"
            />
            {dynamicVariables.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Detected variables: {dynamicVariables.join(", ")}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {'Use {{}} to add variables. (Learn more)'}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
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
                className="w-full h-24 p-3 border border-gray-300 dark:border-gray-600 rounded resize-none focus:outline-none bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* middle column settings list */}
        <div className="w-full md:w-80 border-l border-r rounded-md shadow-md border-gray-200 dark:border-gray-700 dark:bg-gray-800 mt-4 mb-4 overflow-y-auto">
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
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-800 rounded"
                  onClick={() => {
                    if (item.key === 'functions') {
                      // open modal instead of inline panel
                      setFunctionsModalOpen(true);
                      setActivePanel(null);
                    } else {
                      setActivePanel((s) => (s === item.key ? null : item.key));
                    }
                  }}
                >
                  <item.icon className="w-5 h-5 text-blue-800 dark:text-blue-300" />
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-100">
                    {item.name}
                  </span>
                </button>
                {activePanel === item.key && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800">
                    {renderPanel(item.key)}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

         
        {/* right column testing panel */}
        <div className="w-full md:w-80 p-6 h-50 md:h-full overflow-y-auto">
          <div className="border h-80 rounded-lg p-4 flex justify-between flex-col items-center dark:border-gray-600">
            <div className="flex gap-2 p-[2px] bg-gray-100 dark:bg-gray-700 rounded-lg">
              <button onClick={()=>setButtonChoice('test-call')} className={`p-[4px] rounded-lg ${buttonChoice=='test-call'?'bg-blue-600 text-white':'bg-white dark:bg-gray-600 dark:text-gray-200 text-gray-700'} font-medium text-[12px] px-[8px] flex items-center gap-1 transition-colors`}>
                <PhoneOutgoing className="w-3 h-3" />
                Test Call
              </button>
               <button onClick={()=>setButtonChoice('test-chat')} className={`p-[4px] rounded-lg ${buttonChoice=='test-chat'?'bg-blue-600 text-white':'bg-white dark:bg-gray-600 dark:text-gray-200 text-gray-700'} font-medium text-[12px] px-[8px] flex items-center gap-1 transition-colors`}>
                <MessageCircle className="w-3 h-3" />
                Test Chat
              </button>
              <button className="p-[4px] flex items-center justify-center rounded-lg bg-white dark:bg-gray-600 dark:text-gray-200 text-gray-700">
                <Codepen className="w-4 h-4" />
              </button>
            </div>
            <Mic className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            <div className="text-gray-600 dark:text-gray-300">Test your agent</div>
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
        <div className="fixed top-20 left-20 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300">{error}</div>
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
        <Button variant="primary" size="default">Upload Files Here</Button>
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


  return <SinglePromptAgentContent/>;
}

export default function SinglePromptAgentPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <SinglePromptAgentPageContent />
    </Suspense>
  );
}
