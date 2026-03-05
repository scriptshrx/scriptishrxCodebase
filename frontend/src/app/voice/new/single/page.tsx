"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Pencil,
  Mic,
  Zap,
  Code,
  Music,
  PhoneCall,
  FileText,
  Shield,
  Link as LinkIcon,
  Play,
  Codepen
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || "";

async function apiFetch(path: string, opts: any = {}) {
  const headers: any = {
    "Content-Type": "application/json",
    "x-tenant-id": TENANT_ID,
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

export default function SinglePromptAgentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const template = (searchParams.get("template") || "blank") as
    | "blank"
    | "healthcare_checkin"
    | "notification";

  const [loading, setLoading] = useState(true);

  // core fields
  const [agentId, setAgentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [welcomeMode, setWelcomeMode] = useState("ai");
  const [llmModel, setLlmModel] = useState("GPT-4o");
  const [voiceName, setVoiceName] = useState("Myra");
  const [language, setLanguage] = useState("English");

  const [showTitleInput, setShowTitleInput] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // settings panels
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [functionsList, setFunctionsList] = useState<any[]>([]);
  const [speechSettings, setSpeechSettings] = useState({ speed: 50, sensitivity: 50 });
  const [callSettings, setCallSettings] = useState({ silenceTimeout: 5, maxDuration: 10 });
  const [postCall, setPostCall] = useState({ enableSummaries: false });
  const [security, setSecurity] = useState({ piiRedaction: false });
  const [webhookUrl, setWebhookUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = () => {
      switch (template) {
        case "healthcare_checkin":
          setName("Healthcare Check-In");
          setPrompt(
`You are calling a patient for a health check-in. Greet them, confirm their name and date of birth, ask about symptoms and severity, inquire about allergies and medications. If you detect any emergency signs, advise them to seek emergency services. Offer to transfer to a human if necessary.`
          );
          setWelcomeMessage(
            "Hi, this is ScriptishRx assistant calling for a quick health check-in. How are you feeling today?"
          );
          break;
        case "notification":
          setName("Notification Agent");
          setPrompt(
`You are calling to deliver a notification. First verify the recipient's identity. Deliver the message clearly. Ask if they have any questions. End the call politely.`
          );
          setWelcomeMessage(
            "Hi, this is ScriptishRx with an important update for you."
          );
          break;
        default:
          setName("New Single Prompt Agent");
          setPrompt("");
          setWelcomeMessage("");
      }
      setLoading(false);
    };
    init();
  }, [template]);

  useEffect(() => {
    if (showTitleInput && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [showTitleInput]);

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        agentType: "Single Prompt",
        mode: "single",
        name,
        prompt,
        welcomeMessage,
        voiceName,
        llmModel,
        language,
        template,
        config: {
          functions: functionsList,
          speech: speechSettings,
          callSettings,
          postCall,
          security,
          webhook: { url: webhookUrl },
        },
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
      const body: any = {};
      body.name = name;
      body.prompt = prompt;
      body.welcomeMessage = welcomeMessage;
      body.voiceName = voiceName;
      body.llmModel = llmModel;
      body.language = language;
      body.config = {
        functions: functionsList,
        speech: speechSettings,
        callSettings,
        postCall,
        security,
        webhook: { url: webhookUrl },
      };
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
      <header className="sticky top-0 bg-white z-20 flex items-center justify-between px-6 py-3 shadow">
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
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setShowTitleInput(false)}
                className="w-full"
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
        <div className="flex items-center gap-2">
          <select
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            className="h-8 px-2 border rounded"
          >
            <option>GPT-4o</option>
            <option>GPT-4o-mini</option>
            <option>GPT-3.5</option>
          </select>
          <select
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            className="h-8 px-2 border rounded"
          >
            <option>Markkio</option>
            <option>Jenny</option>
             <option>Gillian</option>
            <option>Default</option>
          </select>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="h-8 px-2 border rounded"
          >
            <option>English</option>
            <option>Spanish</option>
          </select>
          <span className="text-xs text-gray-500 hidden sm:block">
            Estimated Latency: 1100–1250ms
          </span>
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

      <div className="flex flex-1 overflow-hidden">
        {/* left column */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type in a universal prompt for your agent, such as its role, conversational style, objective, etc."
              className="w-full h-64 p-4 border border-gray-300 rounded shadow-sm font-mono resize-none focus:outline-none"
            />
            <p className="text-xs text-gray-500">
              {'Use {{}} to add variables. (Learn more)'}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                Welcome Message
              </label>
              <select
                value={welcomeMode}
                onChange={(e) => setWelcomeMode(e.target.value)}
                className="w-full h-8 px-2 border rounded"
              >
                <option value="ai">
                  AI Initiates: AI begins with your defined begin message.
                </option>
                {/* other modes could be added */}
              </select>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                className="w-full h-24 p-3 border border-gray-300 rounded resize-none focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* middle column settings list */}
        <div className="w-80 border-l border-r border-gray-200 overflow-y-auto">
          <nav className="space-y-1 p-4">
            {[
              { name: "Functions", icon: Code, key: "functions" },
              { name: "Speech Settings", icon: Music, key: "speech" },
              { name: "Call Settings", icon: PhoneCall, key: "call" },
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
        <div className="w-80 p-6 overflow-y-auto">
          <div className="border rounded-lg p-4 flex flex-col items-center gap-4">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled>
                Test Audio
              </Button>
              <Button size="sm" variant="outline" disabled>
                Test LLM
              </Button>
              <Button size="sm" variant="outline">
                <Codepen className="w-4 h-4" />
              </Button>
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
        <div className="p-4 bg-red-100 text-red-800">{error}</div>
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
                className="w-full"
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
                className="w-full"
              />
            </div>
          </div>
        );
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
            />
          </div>
        );
      default:
        return null;
    }
  }
}
