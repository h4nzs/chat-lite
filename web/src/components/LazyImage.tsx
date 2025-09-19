import { useState, useRef, useEffect } from 'react'

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  placeholder?: string
}

export default function LazyImage({ 
  src, 
  placeholder = '/placeholder.png', 
  alt, 
  className,
  ...props 
}: LazyImageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!src) {
      setLoading(false)
      setError(true)
      return
    }

    const img = new Image()
    img.src = src
    
    img.onload = () => {
      setLoading(false)
      if (imgRef.current) {
        imgRef.current.src = src
      }
    }
    
    img.onerror = () => {
      setLoading(false)
      setError(true)
    }
  }, [src])

  return (
    <div className={`relative ${className || ''}`}>
      {loading && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
      )}
      
      {error ? (
        <div className="flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded">
          <span className="text-gray-500">⚠️</span>
        </div>
      ) : (
        <img
          ref={imgRef}
          alt={alt}
          className={`${loading ? 'opacity-0' : 'opacity-100'} ${className || ''}`}
          {...props}
        />
      )}
    </div>
  )
}