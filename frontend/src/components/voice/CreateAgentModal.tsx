"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Plus, Phone, X, Bot } from "lucide-react";
import { Button } from "@/components/ui/Button";
   

interface CreateAgentModalProps {
  open: boolean;
  agents:[];
  onOpenChange: (open: boolean) => void;
}

type PromptMode = "single" | "multi";
type TemplateType = "blank" | "healthcare_checkin" | "notification";

interface Template {
  id: TemplateType;
  title: string;
  subtitle: string;
  description: string;
  icon?: React.ReactNode;
}

const templates: Template[] = [
  {
    
    id: "blank",
    title: "Start from blank",
    subtitle: "Start from blank",
    description: "Start from blank",
    icon: <Plus className="w-8 h-8 bg-blue-100 text-blue-400" />
  },
  {
    id: "healthcare_checkin",
    title: "Wellness Agent",
    subtitle: "Address wellness challlenges from patients",
    description: "Ask questions to gather information, can transfer call."
  },
  {
    id: "appointment",
    title: "Appointment Agent",
    subtitle: "Books callers, as per company schedules",
    description: "Check that schedules align with company calendar before booking."
  }
];

function TemplateCard({
  template,
  agent,
  index,
  onClick
}: {
  template: Template;
  agent;
  index:Number;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="p-6 bg-blue-50 relative border border-blue-200 rounded-lg hover:border-blue-600 hover:shadow-lg transition-all cursor-pointer flex flex-col items-center justify-center min-h-[180px] gap-3"
    >
      
        <Bot className="w-6 h-6 text-blue-600" />
  
      <div className="items-center flex justify-center text-sm text-blue-500 border border-blue-400 h-8 w-8 rounded-full absolute top-4 right-4">{index}</div>
      <div className="text-center">
        <div className="font-semibold text-gray-600 text-sm">{agent?agent.name:template.title}</div>
        <div className="text-xs text-blue-600 mt-1">{agent?agent.id:template.subtitle}</div>
      </div>
      <p className="text-xs text-gray-400 text-center leading-relaxed">
        {agent?agent.agentConfig.prompt.welcome_message:template.description}
      </p>
    </div>
  );
}

function PromptModeSelector({
  selected,
  onSelect
}: {
  selected: PromptMode;
  onSelect: (mode: PromptMode) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Select Prompt Mode</h3>
      <div className="space-y-2">
        <button
          onClick={() => onSelect("single")}
          className={`w-full px-4 py-2 cursor-pointer rounded-lg text-sm font-medium transition-all ${
            selected === "single"
              ? "bg-blue-900 text-white border border-gray-900"
              : "bg-white text-gray-900 border border-gray-300 hover:border-gray-400"
          }`}
        >
          Single Prompt
        </button>
        <button
          onClick={() => onSelect("multi")}
          className={`w-full px-4 py-2 rounded-lg cursor-pointer text-sm font-medium transition-all ${
            selected === "multi"
              ? "bg-blue-900 text-white border border-gray-900"
              : "bg-white text-gray-900 border border-gray-300 hover:border-gray-400"
          }`}
        >
          Multi Prompt
        </button>
      </div>
    </div>
  );
}

export default function CreateAgentModal({
  open,
  agents,
  onOpenChange
}: CreateAgentModalProps) {
  const router = useRouter();
  const [promptMode, setPromptMode] = useState<PromptMode>("single");
  
 const path = usePathname();

  const handleTemplateSelect = (item) => {
    // Close modal
    onOpenChange(false);
 
 
    console.log('Current path is',path);
    // Route based on prompt mode and template
    const route = `/voice/new/${promptMode}?template=${item.id}`;
    localStorage.setItem('template',JSON.stringify(item))
    router.push(route);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
    onClick={()=>onOpenChange(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      onClick={(e)=>e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between shadow-xs px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-blue-700">Create Agent or Use Template</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-red-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel */}
          <div className="w-48 bg-gray-50 border-r border-gray-200 p-6 overflow-y-auto">
            <PromptModeSelector
              selected={promptMode}
              onSelect={setPromptMode}
            />
          </div>

          {/* Main Panel - Cards Grid */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.length>0&&
              <TemplateCard
                 
                  index={0}
                  template={templates[0]}
                 
                  onClick={() => handleTemplateSelect([])}
                />}
              {agents.length<1?
              templates.map((template,i) => (
                <TemplateCard
                  key={i}
                  index={i}
                 
                  template={template}
                 
                  onClick={() => handleTemplateSelect(template)}
                />
              ))
            :
            agents.map((agent,i)=>
            <TemplateCard
                  key={i}
                  index={i+1}
                  agent={agent}
                 
                  onClick={() => handleTemplateSelect(agent)}
                />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
