import React, { useState, useRef } from 'react';
import { apiClient } from '@/api/client';
import { Camera, ImagePlus, Trash2, X, Loader2 } from 'lucide-react';

export default function IssuePhotos({ issue, onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef();
  const cameraRef = useRef();

  const urls = issue?.image_urls || [];

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newUrls = [];
    for (const file of Array.from(files)) {
      const { file_url } = await apiClient.integrations.Core.UploadFile({ file });
      newUrls.push(file_url);
    }
    const updated = [...urls, ...newUrls];
    await apiClient.entities.ProductionIssue.update(issue.id, { image_urls: updated });
    onUpdate({ image_urls: updated });
    setUploading(false);
  };

  const handleDelete = async (url) => {
    if (!window.confirm('Remove this photo?')) return;
    const updated = urls.filter(u => u !== url);
    await apiClient.entities.ProductionIssue.update(issue.id, { image_urls: updated });
    onUpdate({ image_urls: updated });
    if (lightbox === url) setLightbox(null);
  };

  return (
    <div>
      {/* Upload buttons — using <label> for reliable mobile/iOS camera access */}
      <div className="flex gap-2 mb-3">
        <label className={`inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer font-medium transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <ImagePlus className="w-3.5 h-3.5" />
          Upload Photos
        </label>
        <label className={`inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer font-medium transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <Camera className="w-3.5 h-3.5" />
          Take Photo
        </label>
        {uploading && <Loader2 className="w-4 h-4 animate-spin text-blue-500 self-center" />}
      </div>

      {/* Photo grid */}
      {urls.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {urls.map((url, i) => (
            <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
              <img
                src={url}
                alt={`Issue photo ${i + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                onDoubleClick={() => setLightbox(url)}
              />
              <button
                onClick={() => handleDelete(url)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">No photos attached yet.</p>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/40 rounded-full p-1.5"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox}
            alt="Full size"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}