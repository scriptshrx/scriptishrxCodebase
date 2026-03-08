"use client";

import { useState, useEffect } from 'react';
import { Plus, Search as SearchIcon, Trash2, AlertTriangle, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const API_BASE = 'https://scriptshrxcodebase.onrender.com/api';

// Types of

type KnowledgeBase = {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeDocument = {
  id: string;
  tenantId: string;
  knowledgeBaseId: string;
  title: string;
  fileName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

// API helper (same as other views)
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

// row for knowledge base list
const BaseRow = ({ base, selected, onClick }: { base: KnowledgeBase; selected: boolean; onClick: () => void; }) => (
  <div
    onClick={onClick}
    className={`p-4 border-l-4 cursor-pointer transition ${
      selected ? 'border-l-blue-600 bg-blue-50 dark:bg-blue-800' : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-700'
    }`}
  >
    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{base.name}</div>
    {base.description && <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 truncate">{base.description}</div>}
  </div>
);

// main view

type KnowledgeResourcesViewProps = {
  createModalOpen: boolean;
  onCreateModalOpenChange: (open: boolean) => void;
};

export default function KnowledgeResourcesView({
  createModalOpen,
  onCreateModalOpenChange
}: KnowledgeResourcesViewProps) {
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newBaseName, setNewBaseName] = useState('');
  const [newBaseDesc, setNewBaseDesc] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchBases = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/knowledge-bases');
      setBases(data.bases || []);
      if (!selectedBaseId && data.bases && data.bases.length > 0) {
        setSelectedBaseId(data.bases[0].id);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async (kbId: string) => {
    try {
      const data = await apiFetch(`/knowledge-bases/${kbId}/documents`);
      setDocuments(data.documents || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBaseSelect = (id: string) => {
    setSelectedBaseId(id);
    fetchDocuments(id);
  };

  const handleCreateBase = async () => {
    if (!newBaseName.trim()) return;
    try {
      await apiFetch('/knowledge-bases', {
        method: 'POST',
        body: JSON.stringify({ name: newBaseName, description: newBaseDesc })
      });
      setNewBaseName('');
      setNewBaseDesc('');
      fetchBases();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedBaseId) return;
    if (!file) {
      setUploadError('Select a file');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    if (file.name) form.append('title', file.name);
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(`${API_BASE}/knowledge-bases/${selectedBaseId}/documents`, {
        method: 'POST',
        body: form,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'Upload failed. Please try again.');
        return;
      }

      setFile(null);
      setUploadError(null);
      fetchDocuments(selectedBaseId);
    } catch (err: any) {
      setUploadError(err.message || 'Network error during upload');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchBases();
  }, []);

  useEffect(() => {
    if (selectedBaseId) {
      fetchDocuments(selectedBaseId);
    }
  }, [selectedBaseId]);

  return (
    <div className="flex h-full bg-white dark:bg-gray-900 dark:text-gray-100">
      <aside className="w-64 bg-white h-full border-r border-gray-500 flex flex-col dark:bg-gray-800 dark:border-gray-200">
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 flex justify-between items-center">
            <h3 className="font-semibold">Knowledge Bases</h3>
            <button
              onClick={() => onCreateModalOpenChange(true)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {loading && <div className="p-4">Loading...</div>}
          {error && <div className="p-4 text-red-600">{error}</div>}
          {bases.map(b => (
            <BaseRow
              key={b.id}
              base={b}
              selected={b.id === selectedBaseId}
              onClick={() => handleBaseSelect(b.id)}
            />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {!selectedBaseId && (
          <div className="text-gray-600">Select or create a knowledge base.</div>
        )}
        {selectedBaseId && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold mb-4">Upload Document</label>
              <input 
                ref={(input) => {
                  if (input) (window as any).fileInput = input;
                }}
                type="file" 
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
              />
              <div
                onClick={() => {
                  const input = document.getElementById('file-input') as HTMLInputElement;
                  if (input) input.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('bg-blue-50', 'border-blue-400');
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('bg-blue-50', 'border-blue-400');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('bg-blue-50', 'border-blue-400');
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setFile(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-100"
              >
                <div className="flex flex-col items-center gap-3">
                  <SearchIcon className="w-8 h-8 text-gray-400" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-400">
                      Drop files here or click to select
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      <span className='text-green-500'>Supported: </span>
                      [PDF, DOCX, DOC, TXT, MD, CSV, HTML, XLSX, PPT]
                    </p>
                  </div>
                  {file && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-blue-100 rounded">
                      <span className="text-xs text-blue-900">{file.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {uploadError && <p className="text-red-600 text-xs">{uploadError}</p>}
              <Button onClick={handleUpload} disabled={uploading || !file}>
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Documents</h4>
              {documents.length === 0 && (
                <div className="text-gray-600 text-sm">No documents uploaded yet.</div>
              )}
              <ul className="space-y-2">
                {documents.map(doc => (
                  <li key={doc.id} className="flex justify-between items-center p-2 border border-gray-400 shadow-md rounded">
                    <span className="truncate">{doc.fileName || doc.title}</span>
                    <span className="text-xs flex flex-row gap-2 text-gray-500">{doc.status=='processing'&&<div className='h-4 w-4 rounded-full border border-t-[2px] border-green-500 animate-spin'></div>}{doc.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* create KB modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">New Knowledge Base</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Name *</label>
                <Input
                  value={newBaseName}
                  onChange={e => setNewBaseName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <Input
                  value={newBaseDesc}
                  onChange={e => setNewBaseDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => onCreateModalOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => { handleCreateBase(); onCreateModalOpenChange(false);} }>
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
