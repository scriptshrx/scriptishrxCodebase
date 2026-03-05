"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CreateAgentModalProps {
  open: boolean;
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
    icon: <Plus className="w-8 h-8 text-gray-400" />
  },
  {
    id: "healthcare_checkin",
    title: "Healthcare Check-In",
    subtitle: "Transfer call",
    description: "Ask questions to gather information, can transfer call."
  },
  {
    id: "notification",
    title: "Notification",
    subtitle: "Then end the call",
    description: "After giving the notification, end the call."
  }
];

function TemplateCard({
  template,
  onClick
}: {
  template: Template;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="p-6 bg-white border border-gray-200 rounded-lg hover:border-gray-400 hover:shadow-md transition-all cursor-pointer flex flex-col items-center justify-center min-h-[180px] gap-3"
    >
      {template.icon ? (
        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
          {template.icon}
        </div>
      ) : (
        <Phone className="w-6 h-6 text-gray-400" />
      )}
      <div className="text-center">
        <div className="font-semibold text-gray-900 text-sm">{template.title}</div>
        <div className="text-xs text-gray-500 mt-1">{template.subtitle}</div>
      </div>
      <p className="text-xs text-gray-600 text-center leading-relaxed">
        {template.description}
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
          className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selected === "single"
              ? "bg-gray-900 text-white border border-gray-900"
              : "bg-white text-gray-900 border border-gray-300 hover:border-gray-400"
          }`}
        >
          Single Prompt
        </button>
        <button
          onClick={() => onSelect("multi")}
          className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selected === "multi"
              ? "bg-gray-900 text-white border border-gray-900"
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
  onOpenChange
}: CreateAgentModalProps) {
  const router = useRouter();
  const [promptMode, setPromptMode] = useState<PromptMode>("single");

  const handleTemplateSelect = (templateId: TemplateType) => {
    // Close modal
    onOpenChange(false);
    
    // Route based on prompt mode and template
    const route = `/voice/new/${promptMode}?template=${templateId}`;
    router.push(route);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Select Template</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
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
              {templates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => handleTemplateSelect(template.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
