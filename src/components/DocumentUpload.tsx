import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, deleteDoc, doc, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Search,
  X,
  Loader2,
  File,
  FileImage,
  AlertCircle,
  Tag,
  CheckCircle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

export interface PropertyDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  category: 'lease' | 'receipt' | 'other';
  storagePath: string;
  uploadedBy: string;
  userEmail: string;
  createdAt: any;
}

export default function DocumentUpload() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<PropertyDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'lease' | 'receipt' | 'other'>('all');
  
  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fileCategory, setFileCategory] = useState<'lease' | 'receipt' | 'other'>('lease');

  useEffect(() => {
    const q = query(
      collection(db, 'uploaded_documents'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PropertyDoc[];
      setDocuments(docs);
    }, (err) => {
      console.error("Firestore subscription error:", err);
    });

    return () => unsubscribe();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setSuccessMessage(null);

    try {
      const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload failed:", error);
          setUploadError('Failed to upload file to Firebase Storage.');
          setIsUploading(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await addDoc(collection(db, 'uploaded_documents'), {
              name: file.name,
              size: file.size,
              type: file.type,
              url: downloadURL,
              category: fileCategory,
              storagePath: uploadTask.snapshot.ref.fullPath,
              uploadedBy: user.uid,
              userEmail: user.email || 'tenant@propertyflow.app',
              createdAt: serverTimestamp(),
            });

            setSuccessMessage(`"${file.name}" uploaded successfully as ${fileCategory}!`);
            setIsUploading(false);
            setUploadProgress(0);
          } catch (err) {
            console.error("Error saving document metadata:", err);
            setUploadError("Failed to save document metadata in database.");
            setIsUploading(false);
          }
        }
      );
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "An error occurred during upload.");
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: string, storagePath: string) => {
    if (!window.confirm("Are you sure you want to delete this document from Storage?")) return;
    try {
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef).catch(err => {
        // Log but continue if storage file doesn't exist
        console.warn("Storage file delete skipped or not found:", err);
      });
      await deleteDoc(doc(db, 'uploaded_documents', docId));
      setSuccessMessage("Document deleted successfully.");
    } catch (error) {
      console.error("Failed to delete document:", error);
      alert("Failed to delete document.");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredDocs = documents.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || d.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Secure Document Storage
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Store lease agreements and maintenance receipts directly on Google Cloud/Firebase Storage.
          </p>
        </div>

        {/* Category selector for new uploads */}
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-200/50 dark:border-slate-700 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" /> Tag:
          </span>
          <div className="flex gap-1.5 flex-1 md:flex-none">
            {(['lease', 'receipt', 'other'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setFileCategory(cat)}
                className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  fileCategory === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress & Feedback Notifications */}
      {isUploading && (
        <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-700 animate-slide-in">
          <div className="flex justify-between text-sm font-semibold mb-2">
            <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin" /> Uploading to Storage Bucket...
            </span>
            <span className="text-slate-500">{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {successMessage}
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 font-bold hover:text-emerald-700">&times;</button>
        </div>
      )}

      {uploadError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {uploadError}
          </div>
          <button onClick={() => setUploadError(null)} className="text-red-400 font-bold hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Upload Drag & Dropzone / File Browser */}
      <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-8 text-center transition-all bg-slate-50/50 dark:bg-slate-900/30">
        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Supports PDFs, Images, Word Documents, Excel sheets (Max 50MB)
        </p>

        <div className="mt-4">
          <input
            type="file"
            id="cloud-file-upload"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <label
            htmlFor="cloud-file-upload"
            className={`inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer hover:bg-indigo-700 ${
              isUploading ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            Select Document
          </label>
        </div>
      </div>

      {/* Search & List Filter bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search stored documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Filter Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Files</option>
            <option value="lease">Leases Only</option>
            <option value="receipt">Receipts Only</option>
            <option value="other">Other Docs</option>
          </select>
        </div>
      </div>

      {/* Grid List of uploaded files */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <FileText className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-semibold">No files match your search or filter.</p>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  {doc.type?.includes('image') ? (
                    <FileImage className="w-6 h-6 text-blue-500" />
                  ) : (
                    <FileText className="w-6 h-6 text-indigo-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900 dark:text-white truncate text-xs" title={doc.name}>
                    {doc.name}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span className="px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-slate-100 dark:bg-slate-700 text-[9px] text-slate-500 dark:text-slate-300">
                      {doc.category || 'other'}
                    </span>
                    <span>•</span>
                    <span>{formatFileSize(doc.size)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-4 text-[10px] text-slate-400">
                <span>By: {doc.userEmail?.split('@')[0]}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {doc.createdAt?.toDate ? format(doc.createdAt.toDate(), 'MMM d, yyyy') : 'Just now'}
                </span>
              </div>

              {/* Action Buttons Overlay on Hover */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-indigo-600 shadow-sm transition-colors"
                  title="Download File"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => handleDelete(doc.id, doc.storagePath)}
                  className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-red-600 shadow-sm transition-colors"
                  title="Delete File"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
