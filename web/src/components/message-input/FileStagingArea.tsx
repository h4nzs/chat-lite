// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiPaperclip, FiX, FiEdit3, FiCrop } from 'react-icons/fi';
import { useShallow } from 'zustand/react/shallow';
import { useMessageInputStore, type StagedFile } from '@store/messageInput';

interface FileStagingAreaProps {
  // Optional: allow passing stagedFiles directly, otherwise uses store
  stagedFiles?: StagedFile[];
  onPaint?: (file: StagedFile) => void;
  onCrop?: (file: StagedFile, url: string) => void;
}

export function FileStagingArea({
  stagedFiles: externalStagedFiles,
  onPaint,
  onCrop,
}: FileStagingAreaProps) {
  const {
    stagedFiles: storeStagedFiles,
    removeStagedFile,
    updateStagedFile,
  } = useMessageInputStore(
    useShallow((state) => ({
      stagedFiles: state.stagedFiles,
      removeStagedFile: state.removeStagedFile,
      updateStagedFile: state.updateStagedFile,
    }))
  );

  const stagedFiles = externalStagedFiles ?? storeStagedFiles;

  // Preview URL Management (local to this component)
  const [filePreviews, setFilePreviews] = useState<Map<string, string>>(new Map());
  const previewsRef = useRef<Map<string, string>>(new Map());

  // Sync effect for preview URLs
  useEffect(() => {
    const currentMap = previewsRef.current;
    let changed = false;
    const activeIds = new Set(stagedFiles.map((sf) => sf.id));

    // Remove old previews
    for (const [id, url] of currentMap.entries()) {
      if (!activeIds.has(id)) {
        URL.revokeObjectURL(url);
        currentMap.delete(id);
        changed = true;
      }
    }

    // Add new previews
    stagedFiles.forEach((sf) => {
      if (sf.file.type.startsWith('image/') && !currentMap.has(sf.id)) {
        const url = URL.createObjectURL(sf.file);
        currentMap.set(sf.id, url);
        changed = true;
      }
    });

    if (changed) {
      setFilePreviews(new Map(currentMap));
    }
  }, [stagedFiles]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewsRef.current.clear();
    };
  }, []);

  const handlePaint = (staged: StagedFile) => {
    onPaint?.(staged);
  };

  const handleCrop = (staged: StagedFile) => {
    const url = filePreviews.get(staged.id);
    if (url) {
      onCrop?.(staged, url);
    }
  };

  if (stagedFiles.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-2 p-3 bg-bg-surface backdrop-blur-md rounded-2xl shadow-neumorphic-convex border border-white/5 flex gap-3 overflow-x-auto scrollbar-hide"
    >
      {stagedFiles.map((staged) => {
        const isImage = staged.file.type.startsWith('image/');
        const url = isImage ? filePreviews.get(staged.id) : null;

        return (
          <div
            key={staged.id}
            className="relative w-20 h-20 flex-shrink-0 rounded-xl shadow-neumorphic-concave overflow-hidden border border-white/5 group bg-bg-main"
          >
            {isImage && url ? (
              <>
                <img
                  src={url}
                  alt="preview"
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute top-1 left-1 flex items-center gap-1 z-10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handlePaint(staged);
                    }}
                    className="bg-black/60 hover:bg-accent text-white p-1 rounded-full backdrop-blur-md transition-colors"
                    aria-label="Edit image"
                  >
                    <FiEdit3 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleCrop(staged);
                    }}
                    className="bg-black/60 hover:bg-accent text-white p-1 rounded-full backdrop-blur-md transition-colors"
                    aria-label="Crop image"
                  >
                    <FiCrop size={12} />
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary">
                <FiPaperclip size={20} />
                <span className="text-[8px] mt-1 px-1 truncate w-full text-center">
                  {staged.file.name}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => removeStagedFile(staged.id)}
              className="absolute top-1 right-1 bg-black/60 hover:bg-red-500 text-white p-1 rounded-full backdrop-blur-md transition-colors"
              aria-label="Remove file"
            >
              <FiX size={12} />
            </button>
          </div>
        );
      })}
    </motion.div>
  );
}
