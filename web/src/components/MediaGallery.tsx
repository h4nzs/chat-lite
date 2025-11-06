import { useState, useEffect } from 'react';
import { api } from '@lib/api';
import { Spinner } from './Spinner';
import { FiFile, FiImage, FiVideo, FiMusic } from 'react-icons/fi';
import { toAbsoluteUrl } from '@utils/url';

// Assuming a media message has this structure from the backend
// This would come from prisma schema, e.g., Message model with type & content
interface MediaItem {
  id: string;
  content: string; // URL to the media
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  fileName?: string;
}

const MediaIcon = ({ type }: { type: MediaItem['type'] }) => {
  switch (type) {
    case 'IMAGE':
      return <FiImage className="w-8 h-8 text-text-secondary" />;
    case 'VIDEO':
      return <FiVideo className="w-8 h-8 text-text-secondary" />;
    case 'AUDIO':
      return <FiMusic className="w-8 h-8 text-text-secondary" />;
    default:
      return <FiFile className="w-8 h-8 text-text-secondary" />;
  }
};

const MediaGallery = ({ conversationId }: { conversationId: string }) => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMedia = async () => {
      setLoading(true);
      setError(null);
      try {
        // This is the assumed API endpoint. It needs to be created in the backend.
        const mediaItems = await api<MediaItem[]>(`/api/conversations/${conversationId}/media`);
        setMedia(mediaItems);
      } catch (err) {
        setError('Failed to load media. The API endpoint might not exist yet.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, [conversationId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-destructive p-4 bg-destructive/10 rounded-lg">{error}</p>;
  }

  if (media.length === 0) {
    return <p className="text-center text-text-secondary p-4">No media has been shared in this conversation yet.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 p-1">
      {media.map((item) => (
        <a 
          key={item.id} 
          href={toAbsoluteUrl(item.content)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="aspect-square bg-bg-surface rounded-lg shadow-neumorphic-convex flex items-center justify-center overflow-hidden group transition-all active:shadow-neumorphic-pressed"
        >
          {item.type === 'IMAGE' ? (
            <img src={toAbsoluteUrl(item.content)} alt={item.fileName || 'Shared media'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <MediaIcon type={item.type} />
              {item.fileName && <span className="text-xs text-text-secondary truncate max-w-full px-1">{item.fileName}</span>}
            </div>
          )}
        </a>
      ))}
    </div>
  );
};

export default MediaGallery;
