import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { GoogleWorkspaceService } from '../lib/workspace';
import {
  Plus,
  Wrench,
  UploadCloud,
  X,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertTriangle,
  FileText,
  Tag,
  Building
} from 'lucide-react';

export default function QuickActions() {
  const { user, userData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'maintenance' | 'upload' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Maintenance Request Form State ---
  const [unit, setUnit] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'routine' | 'high' | 'urgent'>('routine');
  const [category, setCategory] = useState('general');
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState(false);
  const [maintenanceSuccess, setMaintenanceSuccess] = useState<string | null>(null);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);

  // Maintenance AI Assistant State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  // --- Document Upload State ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileCategory, setFileCategory] = useState<'lease' | 'receipt' | 'other'>('lease');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // --- Maintenance Action Handlers ---
  const handleAiAnalysis = async () => {
    if (!description.trim()) {
      setMaintenanceError('Please describe the issue first so the AI Smart-Assistant has context to analyze!');
      return;
    }

    setIsAnalyzing(true);
    setMaintenanceError(null);
    setAiFeedback(null);
    setAiExplanation(null);

    try {
      const response = await fetch('/api/maintenance/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });

      if (!response.ok) {
        throw new Error('AI Analysis server request failed');
      }

      const data = await response.json();
      
      if (data.summary) {
        setTitle(data.summary);
      }
      if (data.priority) {
        setUrgency(data.priority);
      }
      if (data.category) {
        setCategory(data.category);
      }
      if (data.explanation) {
        setAiExplanation(data.explanation);
      }
      setAiFeedback('AI Smart-Assistant auto-classified this issue! Review and submit below.');
    } catch (err: any) {
      console.error('AI Smart Assistant error:', err);
      setMaintenanceError('The AI dispatch server is currently offline or busy. Please fill out details manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit.trim() || !description.trim() || !title.trim()) {
      setMaintenanceError('Please fill in all required fields.');
      return;
    }

    setIsSubmittingMaintenance(true);
    setMaintenanceError(null);

    try {
      // Sync with Workspace form if connected
      try {
        await GoogleWorkspaceService.createMaintenanceForm();
      } catch (wsErr) {
        console.warn('Workspace sync skipped or not connected:', wsErr);
      }

      await addDoc(collection(db, 'maintenance_requests'), {
        title,
        description,
        unit,
        urgency,
        priority: urgency,
        category,
        status: 'pending',
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || 'tenant@propertyflow.app',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: 'Quick Action FAB'
      });

      setMaintenanceSuccess('Maintenance request successfully submitted!');
      // Reset Form fields
      setUnit('');
      setTitle('');
      setDescription('');
      setUrgency('routine');
      setCategory('general');
      setAiExplanation(null);
      setAiFeedback(null);

      // Close modal after a brief delay
      setTimeout(() => {
        setActiveModal(null);
        setMaintenanceSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting maintenance request:', err);
      setMaintenanceError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmittingMaintenance(false);
    }
  };

  // --- Document Upload Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
      setUploadSuccess(null);
    }
  };

  const handleDocUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setIsUploadingDoc(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const storageRef = ref(storage, `documents/${Date.now()}_${selectedFile.name}`);
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload failed:", error);
          setUploadError('Failed to upload file to Firebase Storage.');
          setIsUploadingDoc(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await addDoc(collection(db, 'uploaded_documents'), {
              name: selectedFile.name,
              size: selectedFile.size,
              type: selectedFile.type,
              url: downloadURL,
              category: fileCategory,
              storagePath: uploadTask.snapshot.ref.fullPath,
              uploadedBy: user.uid,
              userEmail: user.email || 'tenant@propertyflow.app',
              createdAt: serverTimestamp(),
            });

            setUploadSuccess(`"${selectedFile.name}" uploaded successfully!`);
            setSelectedFile(null);
            setIsUploadingDoc(false);
            setUploadProgress(0);

            // Close modal after a brief delay
            setTimeout(() => {
              setActiveModal(null);
              setUploadSuccess(null);
            }, 2000);
          } catch (err) {
            console.error("Error saving document metadata:", err);
            setUploadError("Failed to save document metadata in database.");
            setIsUploadingDoc(false);
          }
        }
      );
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "An error occurred during upload.");
      setIsUploadingDoc(false);
    }
  };

  return (
    <div className="fixed bottom-14 right-6 z-50 flex flex-col items-end" ref={menuRef}>
      {/* Floating Action Menu Items */}
      {isOpen && (
        <div className="flex flex-col items-end gap-3 mb-4 animate-fade-in-up">
          {/* Action 1: New Maintenance Request */}
          <div className="flex items-center gap-2">
            <span className="bg-slate-900/90 text-white dark:bg-slate-800/95 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg backdrop-blur-sm">
              New Maintenance Request
            </span>
            <button
              onClick={() => {
                setActiveModal('maintenance');
                setIsOpen(false);
              }}
              className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
              aria-label="New Maintenance Request"
            >
              <Wrench className="w-5 h-5" />
            </button>
          </div>

          {/* Action 2: Upload Document */}
          <div className="flex items-center gap-2">
            <span className="bg-slate-900/90 text-white dark:bg-slate-800/95 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg backdrop-blur-sm">
              Upload Document
            </span>
            <button
              onClick={() => {
                setActiveModal('upload');
                setIsOpen(false);
              }}
              className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
              aria-label="Upload Document"
            >
              <UploadCloud className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95 z-50 ${
          isOpen ? 'rotate-135 bg-slate-800' : ''
        }`}
        aria-label="Quick Actions"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* --- MODAL 1: Maintenance Smart-Assistant Submission --- */}
      {activeModal === 'maintenance' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Quick Maintenance Request</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleMaintenanceSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {maintenanceSuccess && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-slide-in">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{maintenanceSuccess}</span>
                </div>
              )}

              {maintenanceError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center justify-between animate-slide-in">
                  <span>{maintenanceError}</span>
                  <button type="button" onClick={() => setMaintenanceError(null)} className="text-red-400 hover:text-red-600 font-bold">&times;</button>
                </div>
              )}

              {/* Unit Info */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" /> Unit / Property *
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                  placeholder="e.g. Sunset Apartments, Apt 4B"
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Description & AI Button */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Description *
                  </label>
                  <button
                    type="button"
                    onClick={handleAiAnalysis}
                    disabled={isAnalyzing}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Smart-dispatch with AI
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                  placeholder="Describe the issue in details (e.g., sink is leaking, sparks from electrical outlet...)"
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              {/* AI Assistant Output Feedback Card */}
              {aiFeedback && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 rounded-xl flex gap-3 items-start animate-slide-in">
                  <div className="p-1.5 rounded-lg bg-indigo-600 text-white mt-0.5 flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-indigo-900 dark:text-indigo-200">{aiFeedback}</h4>
                    {aiExplanation && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">AI Logic:</span> {aiExplanation}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Auto-populated Summary Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Issue Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Faucet dripping / AC fan broken"
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Trade Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none capitalize font-semibold"
                >
                  <option value="general">General Repairs</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="hvac">HVAC / Heating & Cooling</option>
                  <option value="appliance">Appliance repair</option>
                  <option value="structural">Structural</option>
                  <option value="carpentry">Carpentry</option>
                  <option value="pest_control">Pest Control</option>
                </select>
              </div>

              {/* Urgency selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Urgency Level *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['routine', 'high', 'urgent'] as const).map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setUrgency(lvl)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${
                        urgency === lvl
                          ? lvl === 'urgent'
                            ? 'bg-red-600 text-white border-red-600 shadow-md'
                            : lvl === 'high'
                            ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                            : 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMaintenance}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-70 min-w-[120px]"
                >
                  {isSubmittingMaintenance ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Document Quick Upload --- */}
      {activeModal === 'upload' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Quick Document Upload</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleDocUploadSubmit} className="p-6 space-y-5">
              {uploadSuccess && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-slide-in">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {uploadError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center justify-between animate-slide-in">
                  <span>{uploadError}</span>
                  <button type="button" onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600 font-bold">&times;</button>
                </div>
              )}

              {/* Tag Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Document Category Tag
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['lease', 'receipt', 'other'] as const).map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setFileCategory(cat)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${
                        fileCategory === cat
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Drag/Browse box */}
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-6 text-center transition-all bg-slate-50/50 dark:bg-slate-900/30 relative">
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {selectedFile ? `Selected: ${selectedFile.name}` : 'Click below to select a file'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports PDF, images, docs (Max 50MB)
                </p>

                <div className="mt-4">
                  <input
                    type="file"
                    id="quick-file-upload-input"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isUploadingDoc}
                  />
                  <label
                    htmlFor="quick-file-upload-input"
                    className={`inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                      isUploadingDoc ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    Select File
                  </label>
                </div>
              </div>

              {/* Uploading Status */}
              {isUploadingDoc && (
                <div className="space-y-1.5 animate-slide-in">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading to Storage...
                    </span>
                    <span className="text-slate-500 font-mono tabular-nums">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingDoc || !selectedFile}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 min-w-[120px]"
                >
                  {isUploadingDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload File'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
