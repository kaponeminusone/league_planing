import { useState } from 'react'
import { useIntersectionObserver } from '../hooks/useIntersectionObserver'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
}

export function LazyImage({ src, alt, className }: LazyImageProps) {
  const { ref, visible } = useIntersectionObserver('120px')
  const [loaded, setLoaded] = useState(false)

  return (
    <div ref={ref} className={`lazy-image ${className ?? ''}`}>
      {!loaded && <div className="lazy-image__skeleton" aria-hidden />}
      {visible && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={loaded ? 'lazy-image__img loaded' : 'lazy-image__img'}
        />
      )}
    </div>
  )
}
