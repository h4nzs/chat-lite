// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
/**
 * Media Composition Service
 * 
 * Handles heavy browser API operations for media processing:
 * - Audio recording (MediaRecorder API)
 * - Voice anonymization (Web Audio API)
 * - File validation and compression
 * - Image processing utilities
 */

import { compressImage } from '@lib/fileUtils';
import toast from 'react-hot-toast';

// ============================================================================
// Types
// ============================================================================

export interface RecordingConfig {
  anonymizeVoice: boolean;
  mimeType?: string;
  audioBitsPerSecond?: number;
}

export interface RecordingResult {
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
  audioContext: AudioContext | null;
}

export interface FileValidationResult {
  validFiles: File[];
  rejectedFiles: Array<{ file: File; reason: string }>;
}

export interface FileProcessingOptions {
  maxFileSize?: number;
  maxFiles?: number;
  isHD?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const RESTRICTED_EXTENSIONS = [
  '.exe', '.sh', '.bat', '.cmd', '.msi', '.vbs', '.js', '.ts',
  '.html', '.php', '.phtml', '.php5', '.py', '.rb', '.pl',
  '.jar', '.com', '.scr', '.cpl', '.msc',
];

const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_MAX_FILES = 10;
const DEFAULT_AUDIO_BITRATE = 64000;
const DEFAULT_AUDIO_MIME_TYPE = 'audio/webm;codecs=opus';

// ============================================================================
// Audio Recording Functions
// ============================================================================

/**
 * Creates an audio processing chain for voice anonymization
 * Uses Web Audio API to apply lowpass filter and ring modulator
 */
function createAnonymizedAudioStream(
  sourceStream: MediaStream
): { stream: MediaStream; audioContext: AudioContext } {
  const AudioContextClass = window.AudioContext || (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext;
  const audioCtx = new AudioContextClass();

  const source = audioCtx.createMediaStreamSource(sourceStream);

  // 1. Lowpass Filter (Muffles the voice, removes identifying high frequencies)
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800; // Hz

  // 2. Ring Modulator (Robotic/Dalek vibration)
  const oscillator = audioCtx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = 40; // 40Hz vibration

  const ringModulator = audioCtx.createGain();
  ringModulator.gain.value = 0;

  // Wire it up: oscillator modulates the gain, source goes through the gain, then through filter
  oscillator.connect(ringModulator.gain);
  source.connect(ringModulator);
  ringModulator.connect(filter);

  const destination = audioCtx.createMediaStreamDestination();
  filter.connect(destination);

  oscillator.start();

  return { stream: destination.stream, audioContext: audioCtx };
}

/**
 * Initialize audio recording with optional voice anonymization
 * @param config - Recording configuration including anonymization option
 * @returns Recording result with MediaRecorder instance and stream
 */
export async function startAudioRecording(
  config: RecordingConfig
): Promise<RecordingResult> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
  let finalStream = stream;
  let audioContext: AudioContext | null = null;

  if (config.anonymizeVoice) {
    const anonymized = createAnonymizedAudioStream(stream);
    finalStream = anonymized.stream;
    audioContext = anonymized.audioContext;
  }

  const options = {
    mimeType: config.mimeType ?? DEFAULT_AUDIO_MIME_TYPE,
    audioBitsPerSecond: config.audioBitsPerSecond ?? DEFAULT_AUDIO_BITRATE,
  };

  const mediaRecorder = new MediaRecorder(finalStream, options);

  return {
    mediaRecorder,
    stream: finalStream,
    audioContext,
  };
}

/**
 * Stop audio recording and return the recorded blob
 * @param mediaRecorder - The MediaRecorder instance to stop
 * @param audioChunks - Array of audio chunks collected during recording
 * @returns Promise resolving to the recorded audio Blob
 */
export async function stopAudioRecording(
  mediaRecorder: MediaRecorder,
  audioChunks: Blob[]
): Promise<Blob> {
  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      resolve(audioBlob);
    };

    mediaRecorder.stop();
  });
}

/**
 * Cancel audio recording without saving
 * @param mediaRecorder - The MediaRecorder instance to stop
 * @param stream - The media stream to clean up
 * @param audioContext - Optional audio context to close
 */
export function cancelAudioRecording(
  mediaRecorder: MediaRecorder,
  stream: MediaStream,
  audioContext: AudioContext | null
): void {
  mediaRecorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  
  if (audioContext) {
    audioContext.close().catch(() => {});
  }
}

// ============================================================================
// File Processing Functions
// ============================================================================

/**
 * Validate and process selected files
 * @param files - Array of File objects to validate
 * @param options - Processing options (max size, max files, HD mode)
 * @returns Validation result with valid and rejected files
 */
export function processFileSelection(
  files: File[],
  options: FileProcessingOptions = {}
): FileValidationResult {
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    maxFiles = DEFAULT_MAX_FILES,
  } = options;

  const validFiles: File[] = [];
  const rejectedFiles: Array<{ file: File; reason: string }> = [];

  for (const file of files) {
    // Check file size
    if (file.size > maxFileSize) {
      rejectedFiles.push({
        file,
        reason: `File size exceeds ${maxFileSize / 1024 / 1024}MB limit`,
      });
      continue;
    }

    // Check restricted extensions
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (RESTRICTED_EXTENSIONS.includes(ext)) {
      rejectedFiles.push({
        file,
        reason: 'Restricted file type',
      });
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, rejectedFiles };
}

/**
 * Compress an image file based on HD mode setting
 * @param file - The image file to compress
 * @param isHD - Whether to use HD quality (less compression)
 * @returns Promise resolving to the compressed file
 */
export async function processImageFile(
  file: File,
  isHD: boolean = false
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    return await compressImage(file, isHD);
  } catch (error) {
    console.warn('Image compression failed, using original:', error);
    return file;
  }
}

/**
 * Validate file count against maximum allowed
 * @param currentCount - Current number of staged files
 * @param newCount - Number of files being added
 * @param maxFiles - Maximum allowed files per message
 * @returns True if valid, false otherwise
 */
export function validateFileCount(
  currentCount: number,
  newCount: number,
  maxFiles: number = DEFAULT_MAX_FILES
): boolean {
  return currentCount + newCount <= maxFiles;
}

/**
 * Get human-readable file size
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Get file type icon/label based on MIME type
 * @param mimeType - The MIME type of the file
 * @returns Icon label or type description
 */
export function getFileTypeLabel(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('video/')) return 'Video';
  if (mimeType.startsWith('audio/')) return 'Audio';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'Document';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Spreadsheet';
  return 'File';
}

/**
 * Check if file is an image
 * @param file - The file to check
 * @returns True if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Check if file is a video
 * @param file - The file to check
 * @returns True if file is a video
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/**
 * Check if file is an audio file
 * @param file - The file to check
 * @returns True if file is an audio file
 */
export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/');
}

// ============================================================================
// Recording State Management Helpers
// ============================================================================

/**
 * Format recording time as MM:SS
 * @param seconds - Recording duration in seconds
 * @returns Formatted time string
 */
export function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Create a recording interval timer
 * @param onTick - Callback fired every second with current time
 * @returns Function to clear the interval
 */
export function startRecordingTimer(
  onTick: (time: number) => void
): () => void {
  let time = 0;
  
  const intervalId = setInterval(() => {
    time++;
    onTick(time);
  }, 1000);

  return () => clearInterval(intervalId);
}
