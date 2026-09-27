const authHeaders = () => {
  const headers = new Headers();
  const token = window.localStorage.getItem('vortex_one_session') || '';
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
};

export const storage = {};
export const ref = (_storage: unknown, path: string) => ({ path });

export const uploadBytesResumable = (storageRef: { path: string }, file: File) => {
  let next: ((snapshot: any) => void) | undefined;
  let errorHandler: ((error: Error) => void) | undefined;
  let complete: (() => void) | undefined;
  const task: any = {
    snapshot: { ref: storageRef, bytesTransferred: 0, totalBytes: file.size },
    on: (_event: string, n?: any, e?: any, c?: any) => {
      next = n; errorHandler = e; complete = c;
      void (async () => {
        try {
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
            reader.readAsDataURL(file);
          });
          const headers = authHeaders();
          headers.set('Content-Type', 'application/json');
          const response = await fetch('/api/storage', {
            method: 'POST', headers,
            body: JSON.stringify({ path: storageRef.path, name: file.name, type: file.type, data })
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Upload failed');
          task.snapshot = { ...task.snapshot, bytesTransferred: file.size, totalBytes: file.size, ref: { ...storageRef, downloadURL: payload.downloadURL } };
          next?.(task.snapshot); complete?.();
        } catch (err) { errorHandler?.(err as Error); }
      })();
    }
  };
  return task;
};
export const getDownloadURL = async (storageRef: { downloadURL?: string; path: string }) =>
  storageRef.downloadURL || `/api/storage/${encodeURIComponent(storageRef.path)}`;

export const deleteObject = async (storageRef: { path: string }) => {
  const token = window.localStorage.getItem('vortex_one_session') || '';
  const response = await fetch(`/api/storage/${encodeURIComponent(storageRef.path)}`, {
    method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) throw new Error('Unable to delete file');
};
