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
  Bot,
  CalendarCheck,
  Calendar,
  User,
  PhoneOff,
  ClosedCaption,
  X,
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
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
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

  const [calendarSettings, setCalendarSettings] = useState({
    apiKey: '',
    eventTypeSlug: ''
  });

  const [showTitleInput, setShowTitleInput] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // settings panel
  const [activePanel, setActivePanel] = useState<string | null>(null);
  // each function has at least a `type` and optional `name`
  const [functionsList, setFunctionsList] = useState<any[]>([]);
  // modal open state for editing functions
  const [functionsModalOpen, setFunctionsModalOpen] = useState(false);

  // available built-in types
  const functionOptions = [
    {
      value: "check_schedule",
      label: "Check Schedule [cal.com]",
      icon: CalendarCheck,
    },
    {
      value: "book_appointment",
      label: "Book Appointment [cal.com])",
      icon: Calendar,
    },
    { value: "send_sms", label: "Send SMS", icon: MessageCircle },

    { value: "transfer_call", label: "Transfer Call", icon: PhoneOutgoing },
    { value: "agent_transfer", label: "Agent Transfer", icon: User },
    { value: "end_call", label: "End Call", icon: PhoneOff },

    { value: "custom", label: "Custom Function", icon: Code },
  ];
  const [speechSettings, setSpeechSettings] = useState({
    speed: 50,
    sensitivity: 50,
  });
  const [callSettings, setCallSettings] = useState({
    silenceTimeout: 5,
    maxDuration: 10,
  });
  const [postCall, setPostCall] = useState({ enableSummaries: false });
  const [security, setSecurity] = useState({ piiRedaction: false });
  const [buttonChoice, setButtonChoice] = useState("test-call");
  //functions state for all default functions:

  const [endCallFunction, setEndCallFunction] = useState({});
  const [checkScheduleFunction, setCheckScheduleFunction] = useState({});
  const [bookAppointmentFunction, setBookAppointmentFunction] = useState({});
  const [sendSmsFunction, setSendSmsFunction] = useState({});

  // modal state for functions editor
  const [selectedFunction, setSelectedFunction] = useState<any>({});
  const [openSelectedFunction, setOpenSelectedFunction] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const params = useSearchParams();
  useEffect(() => {
    console.log("Params:", params);
  }, []);

  useEffect(() => {
    if (window && typeof window !== undefined) {
      const item = localStorage.getItem("template");
      if (item) {
        const template = JSON.parse(item);
        console.log("Template:", template);
        if (template.id == "blank") {
          setName(template.id);
          setWelcomeMessage(template.subtitle);

          setPrompt(template.description);
          setLoading(false);
          return;
        }

        if(template.id=="healthcare_checkin [template]"){
           setName(template.id);
          setWelcomeMessage(template.subtitle);

          setPrompt(template.description);
          setLoading(false);

          return
        }

          if(template.id=="appointment [template]"){
           setName(template.id);
          setWelcomeMessage(template.subtitle);

          setPrompt(template.description);
          setLoading(false);

          return
        }

        setName(`${template.name}-Edit`);
        setAgentId(params.get('editing') ? template.id : null);
        setCallSettings(template.agentConfig.call_settings);
        setLanguage(template.agentConfig.speech.language || "English");
        setLlmModel(template.agentConfig.llm.model);
        setPrompt(template.agentConfig.prompt.system_prompt);
        setWelcomeMessage(template.agentConfig.prompt.welcome_message);
        setDynamicVariables(template.agentConfig.dynamic_variables);
        setFunctionsList(template.agentConfig.functions);
        setSpeechSettings(template.agentConfig.speech);
        setVoiceId(template.agentConfig.voice.voice_id);
        setCalendarSettings(template.agentConfig.calendar || { apiKey: '', eventTypeSlug: '' });
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (showTitleInput && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [showTitleInput]);

  //Creating the agent

  // agentConfig is built at request time using state instead of attempting to mutate a local variable
  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      // construct agentConfig object according to specs
      const agentConfig = {
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
        calendar: calendarSettings,
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
      router.push(`/voiceAgent`);
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
        calendar: calendarSettings,
        dynamic_variables: dynamicVariables,
      };

       const body = {
        agentType: "Single Prompt",
        mode: "single",
        name,
        agentConfig,
      };
      // const body: any = { agentConfig };
      await apiFetch(`/api/voice-agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      setError('Saved successfully')
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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const exp = payload.exp;
      if (exp && exp < Date.now() / 1000) {
        console.log("Token expired, routing to login:", exp);
        router.push("/login");
      }
    }
  }, []);

  if (loading) {
    return <div className="p-10 text-center">Loading...</div>;
  }

  //functionsList Modal

  function FunctionsModal() {
    return (
      <div
        className="flex inset-0 w-full fixed p-8 bg-white/20 dark:bg-black/20 backdrop-blur-md items-center z-[100] justify-center"
        onClick={() => setFunctionsModalOpen(false)}
      >
        <div className="shadow-md p-4 overflow-hidden overflow-y-auto rounded-lg flex flex-col gap-2 bg-gray-200 dark:bg-gray-900">
          {functionOptions.map((f, i) => {
            const Icon = f.icon;

            return (
              <button
                type="button"
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFunction(f);
                  setOpenSelectedFunction(true);
                  //setFunctionsModalOpen(false);
                }}
                className="p-2 px-2 rounded-md cursor-pointer flex border bg-gray-300 dark:bg-gray-800 border-gray-100 hover:text-blue-500 dark:border-gray-700 hover:bg-blue-100/50 dark:hover:bg-blue-100/20 dark:border-gray-700"
              >
                {f.icon && (
                  <Icon height={20} width={20} className="text-blue-600 mr-2" />
                )}{" "}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  //handler for setting each function into the agentConfig

  // (hook declarations were moved above to avoid conditional rendering)

  const renderSelectedFunctionModal = (selectedFunction) => {
    switch (selectedFunction.value || "end_call") {
      case "end_call":
        return (
          openSelectedFunction && (
            <div
              className="flex fixed inset-0 bg-white/50 backdrop-blur-md items-center z-[150] justify-center"
              onClick={() => setOpenSelectedFunction(false)}
            >
              <div
                className="flex flex-col gap-2 p-4 rounded-lg mx-auto top-20 bg-white dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
              >
                <label htmlFor="name">Name</label>
                <input
                  readOnly
                  className="border bg-gray-300 dark:bg-gray-600 border-gray-700 placeholder:text-blue-600 rounded-md p-2 px-4"
                  placeholder={selectedFunction.value}
                />

                <label htmlFor="description">Description</label>
                <input
                  id="description"
                  className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                  onChange={(e) =>
                    setEndCallFunction({
                      name: "end_call",
                      description: e.target.value,
                      type: "object",
                    })
                  }
                  placeholder="Ends the call when done"
                />
                <Button
                  variant="primary"
                  onClick={() => {
                    setOpenSelectedFunction(false);
                    // add the configured functions to our stateful list so it persists across renders
                    setFunctionsList((prev) => {
                      const updated = [
                        ...prev,
                        { endCallFunction: endCallFunction },
                      ];
                      console.log("functionsList updated", updated);
                      return updated;
                    });
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          )
        );

      case "check_schedule":
        return (
          openSelectedFunction && (
            <div
              className="flex fixed inset-0 bg-white/50 backdrop-blur-md items-center z-[150] justify-center"
              onClick={() => setOpenSelectedFunction(false)}
            >
              <div
                className="flex flex-col grid grid-cols-2 gap-2 p-4 rounded-lg mx-auto top-20 bg-white dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col">
                  <label htmlFor="name">Name</label>
                  <input
                    readOnly
                    className="border bg-gray-300 placeholder:text-blue-600 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4"
                    placeholder={selectedFunction.value}
                  />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="description">Description</label>
                  <input
                    id="description"
                    className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                    onChange={(e) =>
                      setCheckScheduleFunction((prev) => ({
                        ...prev,
                        name: selectedFunction.value,
                        description: e.target.value,
                        type: "object",
                      }))
                    }
                    placeholder="Checks availability on your calender"
                  />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="provider">Provider</label>
                  <input
                    id="provider"
                    className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                    placeholder="Calendar provider (cal.com)"
                  />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="eventId">Event Type ID</label>
                  <input
                    id="eventId"
                    className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                    onChange={(e) =>
                      setCheckScheduleFunction((prev) => ({
                        ...prev,
                        eventTypeId: e.target.value,
                      }))
                    }
                    placeholder="Event type ID from cal.com"
                  />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="tz">Time Zone</label>
                  <input
                    id="tz"
                    className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                    onChange={(e) =>
                      setCheckScheduleFunction((prev) => ({
                        ...prev,
                        name: selectedFunction.value,
                        timezone: e.target.value,

                        type: "object",
                      }))
                    }
                    placeholder='"eg. Africa/Lagos"'
                  />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="daysSpan">Days Span</label>
                  <input
                    id="daysSpan"
                    type="number"
                    className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                    onChange={(e) =>
                      setCheckScheduleFunction((prev) => ({
                        ...prev,
                        name: selectedFunction.value,
                        daysSpan: e.target.value,

                        type: "object",
                      }))
                    }
                    placeholder="Allowed search days span"
                  />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="maxSlots">Max Slots</label>
                  <input
                    id="maxSlots"
                    type="number"
                    className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                    onChange={(e) =>
                      setCheckScheduleFunction((prev) => ({
                        ...prev,
                        maxSlots: e.target.value,
                      }))
                    }
                    placeholder="Max slots to return"
                  />
                </div>

                <div className="flex flex-col">
                  <div>
                    {" "}
                    <Button
                      variant="primary"
                      onClick={() => {
                        setOpenSelectedFunction(false);
                        console.log(checkScheduleFunction);
                        setFunctionsList((prev) => {
                          const updated = [
                            ...prev,
                            { checkScheduleFunction: checkScheduleFunction },
                          ];
                          console.log("functionsList updated", updated);
                          return updated;
                        });
                      }}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )
        );

      case "book_appointment":
        return (
          openSelectedFunction && (
            <div
              className="flex fixed inset-0 bg-white/50 backdrop-blur-md items-center z-[150] justify-center"
              onClick={() => setOpenSelectedFunction(false)}
            >
              <div
                className="flex flex-col gap-2 p-6 h-full my-8 overflow-hidden overflow-y-auto rounded-lg mx-auto top-20 bg-white dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
              >
                <label htmlFor="name">Name</label>
                <input
                  readOnly
                  className="border bg-gray-300 dark:bg-gray-600 placeholder:text-blue-600 border-gray-700 rounded-md text-blue-600 p-2 px-4"
                  placeholder={selectedFunction.value}
                />

                <label htmlFor="description">Description</label>
                <input
                  id="description"
                  className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                  onChange={(e) =>
                    setBookAppointmentFunction((prev) => ({
                      ...prev,
                      name: selectedFunction.value,
                      description: e.target.value,
                      type: "object",
                    }))
                  }
                  placeholder="Books appointment for the caller"
                />

                <div className="flex flex-col">
                  <label htmlFor="provider">Provider</label>
                  <input
                    id="provider"
                    className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 placeholder:text-blue-600"
                    readOnly
                    placeholder="Calendar provider (cal.com)"
                  />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="eventId">Event Type ID</label>
                  <input
                    id="eventId"
                    className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                    onChange={(e) =>
                      setBookAppointmentFunction((prev) => ({
                        ...prev,
                        eventTypeId: e.target.value,
                      }))
                    }
                    placeholder="Event type ID from cal.com"
                  />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="tz">Time Zone</label>
                  <input
                    id="tz"
                    className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                    onChange={(e) =>
                      setBookAppointmentFunction((prev) => ({
                        ...prev,
                        name: selectedFunction.value,
                        timezone: e.target.value,

                        type: "object",
                      }))
                    }
                    placeholder='"eg. Africa/Lagos"'
                  />
                </div>

                {/**Parameters */}
                <label className="text-blue-600 font-bold">Parameters</label>

                <label htmlFor="callerName">Caller Name</label>
                <input
                  id="callerName"
                  type="checkbox"
                  className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                  onChange={(e) =>
                    setBookAppointmentFunction((prev) => ({
                      ...prev,
                      name: selectedFunction.value,
                      callerName: e.target.checked,
                    }))
                  }
                />
                <label htmlFor="callerPhone">Caller Phone</label>

                <input
                  id="callerPhone"
                  type="checkbox"
                  className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                  onChange={(e) =>
                    setBookAppointmentFunction((prev) => ({
                      ...prev,
                      name: selectedFunction.value,
                      callerPhone: e.target.checked,
                    }))
                  }
                />

                <label htmlFor="callerEmail">Caller E-mail</label>
                <input
                  id="callerEmail"
                  type="checkbox"
                  className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                  onChange={(e) =>
                    setBookAppointmentFunction((prev) => ({
                      ...prev,
                      name: selectedFunction.value,
                      callerEmail: e.target.checked,
                    }))
                  }
                />

                <label htmlFor="callerRequest">Caller Request</label>
                <input
                  id="callerRequest"
                  type="checkbox"
                  className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                  onChange={(e) =>
                    setBookAppointmentFunction((prev) => ({
                      ...prev,

                      callerRequest: e.target.checked,
                    }))
                  }
                />
                <Button
                  variant="primary"
                  onClick={() => {
                    setOpenSelectedFunction(false);
                    console.log(bookAppointmentFunction);
                    setFunctionsList((prev) => {
                      const updated = [
                        ...prev,
                        { bookAppointmentFunction: bookAppointmentFunction },
                      ];
                      console.log("functionsList updated", updated);
                      return updated;
                    });
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          )
        );
      case "send_sms":
        return (
          openSelectedFunction && (
            <div
              className="flex fixed inset-0 bg-white/50 backdrop-blur-md items-center z-[150] justify-center"
              onClick={() => setOpenSelectedFunction(false)}
            >
              <div
                className="flex flex-col gap-2 p-6 h-full my-8 overflow-hidden overflow-y-auto rounded-lg mx-auto top-20 bg-white dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
              >
                <label htmlFor="name">Name</label>

                <input
                  id="name"
                  readOnly
                  className="border bg-gray-300 dark:bg-gray-600/80 placeholder:text-blue-600 border-gray-700 rounded-md text-blue-600 p-2 px-4"
                  placeholder={selectedFunction.value}
                />

                <label htmlFor="name">Description</label>

                <input
                  id="description"
                  className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                  onChange={(e) =>
                    setSendSmsFunction((prev) => ({
                      ...prev,
                      name: selectedFunction.value,
                      description: e.target.value,
                      phone: true,
                      type: "object",
                    }))
                  }
                  placeholder="Send SMS to the caller's phone"
                />

                {/**Parameters */}

                <label htmlFor="callerPhone">Caller Phone</label>
                <input
                  id="callerPhone"
                  type="checkbox"
                  checked
                  readOnly
                  className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                  onChange={(e) =>
                    setSendSmsFunction((prev) => ({
                      ...prev,
                      phone: true,
                    }))
                  }
                />

                <label htmlFor="callerName">Caller Name</label>
                <input
                  id="callerName"
                  type="checkbox"
                  className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                  onChange={(e) =>
                    setSendSmsFunction((prev) => ({
                      ...prev,
                      callerName: e.target.checked,
                    }))
                  }
                />

                <label htmlFor="callerRequest">Caller Request</label>
                <input
                  id="callerRequest"
                  type="checkbox"
                  className="border bg-gray-300 dark:bg-gray-600 border-gray-700 rounded-md p-2 px-4 text-black/90 dark:text-gray-200 dark:placeholder:text-gray-300"
                  onChange={(e) =>
                    setSendSmsFunction((prev) => ({
                      ...prev,

                      callerRequest: e.target.checked,
                    }))
                  }
                />

                <Button
                  variant="primary"
                  onClick={() => {
                    setOpenSelectedFunction(false);
                    console.log(sendSmsFunction);
                    setFunctionsList((prev) => {
                      const updated = [
                        ...prev,
                        { sendSmsFunction: sendSmsFunction },
                      ];
                      console.log("functionsList updated", updated);
                      return updated;
                    });
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          )
        );
    }
  };

  return (
    <div className="flex flex-col bg-gray-50 dark:bg-gray-900 -m-8 mt-16 text-gray-800 dark:text-gray-100">
      {/* functions modal */}

      {functionsModalOpen && <FunctionsModal />}
      {renderSelectedFunctionModal(selectedFunction)}

      {/* headers */}
      <header className="sticky -top-8 right-0 bg-white dark:bg-gray-800 -mt-8 z-20 flex items-center justify-between px-6 py-3 shadow-sm border-b border-gray-200 dark:border-gray-700">
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") setShowTitleInput(false);
                }}
                onChange={(e) => {
                  setName(e.target.value);
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
            Single prompt • Agent ID:{" "}
            {params.editing ? agentId : "Not created yet"}
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
                const matches = Array.from(val.matchAll(/\{\{(.*?)\}\}/g)).map(
                  (m) => m[1],
                );
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
              {"Use {{}} to add variables. (Learn more)"}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Welcome Message
              </label>
              <Select
                value={welcomeMode}
                onChange={(e) => setWelcomeMode(e.target.value)}
                options={[
                  {
                    value: "ai",
                    label:
                      "AI Initiates: AI begins with your defined begin message.",
                  },
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
        <div className="w-full md:w-80 border rounded-md shadow-md border-gray-200 dark:border-gray-600 dark:bg-gray-800 mt-6 mb-6 overflow-y-auto">
          <nav className="space-y-1 p-4">
            {[
              { name: "Functions", icon: Code, key: "functions" },

              { name: "Speech Settings", icon: AudioWaveform, key: "speech" },
              { name: "Call Settings", icon: PhoneCall, key: "call" },
              { name: "Calendar Integration", icon: Calendar, key: "calendar" },
              { name: "Knowledge Resources", icon: BrainCircuit, key: "brain" },
              { name: "Post-Call Analysis", icon: FileText, key: "post" },
              { name: "Security Settings", icon: Shield, key: "security" },
              { name: "Webhook Settings", icon: LinkIcon, key: "webhook" },
            ].map((item) => (
              <div key={item.key}>
                <button
                  className="w-full flex items-center text-left gap-2 px-3 py-2 hover:bg-blue-100/60 dark:hover:bg-blue-800 rounded"
                  onClick={() => {
                    setActivePanel(item.key);
                  }}
                >
                  <item.icon className="w-5 h-5 text-blue-600 dark:text-blue-300" />
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
          <div className="border h-80 rounded-lg border-gray-400 dark:border-gray-300 p-4 flex justify-between flex-col items-center dark:border-gray-600">
            <div className="flex gap-2 p-[2px] bg-gray-100 dark:bg-gray-700 rounded-lg">
              <button
                onClick={() => setButtonChoice("test-call")}
                className={`p-[4px] rounded-lg ${buttonChoice == "test-call" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-600 dark:text-gray-200 text-gray-700"} font-medium text-[12px] px-[8px] flex items-center gap-1 transition-colors`}
              >
                <PhoneOutgoing className="w-3 h-3" />
                Test Call
              </button>
              <button
                onClick={() => setButtonChoice("test-chat")}
                className={`p-[4px] rounded-lg ${buttonChoice == "test-chat" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-600 dark:text-gray-200 text-gray-700"} font-medium text-[12px] px-[8px] flex items-center gap-1 transition-colors`}
              >
                <MessageCircle className="w-3 h-3" />
                Test Chat
              </button>
              <button className="p-[4px] flex items-center justify-center rounded-lg bg-white dark:bg-gray-600 dark:text-gray-200 text-gray-700">
                <Codepen className="w-4 h-4" />
              </button>
            </div>
            <Mic className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            <div className="text-gray-600 dark:text-gray-300">
              Test your agent
            </div>
            <Button onClick={handleTest} disabled={!agentId} className="w-full">
              Test
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="fixed top-20 left-20 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );

  function renderPanel(key: string) {
    switch (key) {
      case "functions":
        return (
          <div className="space-y-2">
            {functionsList.map((f, i) => (
              <div
                key={i}
                className="flex items-center text-gray-800 dark:text-gray-300 rounded-lg bg-gray-500 dark:bg-gray-900 shadow-md justify-between p-2"
              >
                <Bot height={20} width={20} className="text-blue-600 mr-2" />
                <span>{Object.keys(f)[0] || "Unnamed"}</span>
                <X
                  height={20}
                  width={20}
                  className="bg-red-500/30 rounded-full  p-[2px] items-center justify-center cursor-pointer text-red-500"
                  onClick={() =>
                    setFunctionsList((prev) =>
                      prev.filter((_, idx) => idx !== i),
                    )
                  }
                />
              </div>
            ))}
            <Button size="sm" onClick={() => setFunctionsModalOpen(true)}>
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
                  background: `linear-gradient(to right, #6b7280 ${speechSettings.speed}%, #e5e7eb ${speechSettings.speed}%)`,
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
                  background: `linear-gradient(to right, #6b7280 ${speechSettings.sensitivity}%, #e5e7eb ${speechSettings.sensitivity}%)`,
                }}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        );
      case "calendar":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cal.com API Key</label>
              <Input
                type="password"
                value={calendarSettings.apiKey}
                onChange={(e) => setCalendarSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Enter your Cal.com API key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Event Type Slug</label>
              <Input
                value={calendarSettings.eventTypeSlug}
                onChange={(e) => setCalendarSettings(prev => ({ ...prev, eventTypeSlug: e.target.value }))}
                placeholder="Enter your event type slug (e.g., 30min)"
              />
            </div>
          </div>
        );
      case "brain":
        return (
          <div className="flex items-center justify-center p-4 px-2">
            <Button variant="primary" size="default">
              Upload Files Here
            </Button>
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
              onChange={(e) => setSecurity({ piiRedaction: e.target.checked })}
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
  return <SinglePromptAgentContent />;
}

export default function SinglePromptAgentPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <SinglePromptAgentPageContent />
    </Suspense>
  );
}
