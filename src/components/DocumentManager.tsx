import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, deleteDoc, doc } from '../lib/dataClient';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from '../lib/storageClient';
import { db } from '../lib/dataClient';
import { storage } from '../lib/storageClient';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Upload, Trash2, Download, Search, X, Loader2, File, FileImage, FileCode, CheckCircle, AlertCircle } from 'lucide-react';
import { openGooglePicker } from '../lib/googlePicker';

export default function DocumentManager() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'property_documents'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDocuments(docs);
    });
    return () => unsubscribe();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

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
          console.error("Upload failed", error);
          setUploadError('Failed to upload file.');
          setIsUploading(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await addDoc(collection(db, 'property_documents'), {
              name: file.name,
              size: file.size,
              type: file.type,
              url: downloadURL,
              storagePath: uploadTask.snapshot.ref.fullPath,
              uploadedBy: user.uid,
              createdAt: serverTimestamp(),
            });
            setIsUploading(false);
            setUploadProgress(0);
          } catch (err) {
            console.error("Error saving document metadata", err);
            setUploadError("Failed to save document info.");
            setIsUploading(false);
          }
        }
      );
    } catch (err) {
      console.error(err);
      setUploadError("An error occurred during upload.");
      setIsUploading(false);
    }
  };

  const handleGoogleDrivePick = async () => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);

      await openGooglePicker(async (pickedDocs) => {
        if (!user) return;
        
        for (const pDoc of pickedDocs) {
          await addDoc(collection(db, 'property_documents'), {
            name: pDoc.name,
            size: pDoc.sizeBytes,
            type: pDoc.mimeType,
            url: pDoc.url,
            storagePath: `google-drive/${pDoc.id}`,
            uploadedBy: user.uid,
            createdAt: serverTimestamp(),
            isGoogleDriveFile: true,
            googleFileId: pDoc.id
          });
        }
        setIsUploading(false);
      });
    } catch (err: any) {
      console.error('Google Picker Error:', err);
      setUploadError(err.message || 'Failed to select files from Google Drive.');
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: string, storagePath: string, isGoogleDriveFile?: boolean) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      if (!isGoogleDriveFile && storagePath && !storagePath.startsWith('google-drive/')) {
        const fileRef = ref(storage, storagePath);
        await deleteObject(fileRef).catch(() => undefined);
      }
      await deleteDoc(doc(db, 'property_documents', docId));
    } catch (error) {
      console.error("Failed to delete document", error);
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

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <FileImage className="w-8 h-8 text-blue-500" />;
    if (type.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    if (type.includes('spreadsheet') || type.includes('excel')) return <FileCode className="w-8 h-8 text-green-500" />;
    return <File className="w-8 h-8 text-slate-500" />;
  };

  const filteredDocs = documents.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Document Manager</h3>
          <p className="text-sm text-slate-500">Upload and organize lease agreements, reports, and property files.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <button 
            type="button"
            onClick={handleGoogleDrivePick}
            disabled={isUploading}
            className={`flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-sm ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.3499 15.3999L14.3499 6.70001H9.6499L14.6499 15.3999H19.3499Z" fill="#FFC107"/>
              <path d="M9.6499 15.4H19.3499L14.6499 23.6H4.9499L9.6499 15.4Z" fill="#4CAF50"/>
              <path d="M1.0499 15.4L5.7499 7.20001L10.4499 15.4L5.7499 23.6L1.0499 15.4Z" fill="#2196F3"/>
              <path d="M5.7499 7.20001L9.6499 13.9H14.3499L10.4499 7.20001H5.7499Z" fill="#1565C0"/>
            </svg>
            Google Drive
          </button>

          <div className="relative">
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              onChange={handleFileUpload} 
              disabled={isUploading}
            />
            <label 
              htmlFor="file-upload" 
              className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer hover:bg-indigo-700 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isUploading ? 'Uploading...' : 'Upload File'}
            </label>
          </div>
        </div>
      </div>

      {isUploading && (
        <div className="mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-700 dark:text-slate-300 font-medium">Processing document...</span>
            <span className="text-slate-500">{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {uploadError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No documents found</p>
            <p className="text-slate-400 text-sm mt-1">Upload a file or pick from Google Drive to get started</p>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div key={doc.id} className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg relative">
                  {getFileIcon(doc.type)}
                  {doc.isGoogleDriveFile && (
                    <span className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 p-0.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-800">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19.3499 15.3999L14.3499 6.70001H9.6499L14.6499 15.3999H19.3499Z" fill="#FFC107"/>
                        <path d="M9.6499 15.4H19.3499L14.6499 23.6H4.9499L9.6499 15.4Z" fill="#4CAF50"/>
                        <path d="M1.0499 15.4L5.7499 7.20001L10.4499 15.4L5.7499 23.6L1.0499 15.4Z" fill="#2196F3"/>
                        <path d="M5.7499 7.20001L9.6499 13.9H14.3499L10.4499 7.20001H5.7499Z" fill="#1565C0"/>
                      </svg>
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-semibold text-slate-900 dark:text-white truncate" title={doc.name}>
                      {doc.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <span>{formatFileSize(doc.size)}</span>
                    <span>•</span>
                    <span>{doc.createdAt?.toDate ? new Date(doc.createdAt.toDate()).toLocaleDateString() : 'Just now'}</span>
                  </div>
                  {doc.isGoogleDriveFile && (
                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/30">
                      Google Drive
                    </span>
                  )}
                </div>
              </div>
              
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <a 
                  href={doc.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm"
                  title={doc.isGoogleDriveFile ? "Open in Google Drive" : "Download"}
                >
                  <Download className="w-4 h-4" />
                </a>
                <button 
                  onClick={() => handleDelete(doc.id, doc.storagePath, doc.isGoogleDriveFile)}
                  className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors shadow-sm"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
