import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/component/LazyImage.css';

const LazyImage = ({
                       src,
                       thumbnailSrc,
                       alt,
                       className = '',
                       placeholder = '/placeholder-product.png',
                       onLoad = () => {},
                       onError = () => {},
                       enableDebug = false
                   }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [showFullImage, setShowFullImage] = useState(false);
    const [currentSrc, setCurrentSrc] = useState(null);
    const imgRef = useRef();
    const observerRef = useRef();

    // Normalize URLs to prevent loading issues
    const normalizeUrl = useCallback((url) => {
        if (!url) return null;
        if (url === '/placeholder-product.png') return url;

        // If it's already a full URL, use as-is
        if (url.startsWith('http')) return url;

        // If it's a relative path, ensure it starts with /
        if (!url.startsWith('/')) return `/${url}`;

        return url;
    }, []);

    const normalizedSrc = normalizeUrl(src);
    const normalizedThumbnailSrc = normalizeUrl(thumbnailSrc);

    // Debug logging
    useEffect(() => {
        if (enableDebug) {
            console.log('LazyImage props:', {
                src,
                thumbnailSrc,
                alt,
                normalizedSrc,
                normalizedThumbnailSrc
            });
        }
    }, [src, thumbnailSrc, alt, normalizedSrc, normalizedThumbnailSrc, enableDebug]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            {
                threshold: 0.1,
                rootMargin: '200px'
            }
        );

        observerRef.current = observer;

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const handleThumbnailLoad = useCallback(() => {
        if (enableDebug) console.log('Thumbnail loaded:', normalizedThumbnailSrc);
        setIsLoaded(true);
        setCurrentSrc(normalizedThumbnailSrc);
        onLoad();
    }, [normalizedThumbnailSrc, onLoad, enableDebug]);

    const handleFullImageLoad = useCallback(() => {
        if (enableDebug) console.log('Full image loaded:', normalizedSrc);
        setShowFullImage(true);
        setCurrentSrc(normalizedSrc);
    }, [normalizedSrc, enableDebug]);

    const handleError = useCallback((e) => {
        if (enableDebug) console.error('Image failed to load:', e.target.src);
        setHasError(true);
        onError(e);
    }, [onError, enableDebug]);

    const handleThumbnailError = useCallback((e) => {
        if (enableDebug) console.error('Thumbnail failed to load:', e.target.src);
        // If thumbnail fails, try the full image directly
        if (normalizedSrc && normalizedSrc !== normalizedThumbnailSrc) {
            setCurrentSrc(normalizedSrc);
            setIsLoaded(true);
        } else {
            setHasError(true);
        }
    }, [normalizedSrc, normalizedThumbnailSrc, enableDebug]);

    // Determine what to show based on available sources
    const shouldShowThumbnail = normalizedThumbnailSrc &&
        normalizedThumbnailSrc !== '/placeholder-product.png' &&
        normalizedThumbnailSrc !== normalizedSrc;

    const shouldShowFullImage = normalizedSrc && normalizedSrc !== '/placeholder-product.png';

    return (
        <div ref={imgRef} className={`lazy-image-container ${className}`}>
            {!isLoaded && !hasError && (
                <div className="image-placeholder">
                    <div className="loading-spinner"></div>
                </div>
            )}

            {isInView && !hasError && (
                <>
                    {/* Progressive loading: Thumbnail first, then full image */}
                    {shouldShowThumbnail && !showFullImage && (
                        <img
                            src={normalizedThumbnailSrc}
                            alt={alt}
                            className={`thumbnail-image ${isLoaded ? 'loaded' : 'loading'}`}
                            onLoad={handleThumbnailLoad}
                            onError={handleThumbnailError}
                        />
                    )}

                    {/* Full image - load after thumbnail or immediately if no thumbnail */}
                    {isLoaded && shouldShowFullImage && (
                        <img
                            src={normalizedSrc}
                            alt={alt}
                            className={`full-image ${showFullImage ? 'loaded' : 'loading'}`}
                            onLoad={handleFullImageLoad}
                            onError={handleError}
                        />
                    )}

                    {/* Direct loading when no thumbnail available */}
                    {!shouldShowThumbnail && shouldShowFullImage && !isLoaded && (
                        <img
                            src={normalizedSrc}
                            alt={alt}
                            className={`full-image ${isLoaded ? 'loaded' : 'loading'}`}
                            onLoad={() => {
                                setIsLoaded(true);
                                setShowFullImage(true);
                                setCurrentSrc(normalizedSrc);
                                onLoad();
                            }}
                            onError={handleError}
                        />
                    )}
                </>
            )}

            {hasError && (
                <div className="error-image">
                    <img
                        src={placeholder}
                        alt="Failed to load"
                        onError={(e) => {
                            // Prevent infinite error loop
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
            )}

            {enableDebug && (
                <div className="debug-info" style={{
                    position: 'absolute',
                    bottom: '0',
                    left: '0',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    fontSize: '10px',
                    padding: '2px'
                }}>
                    {currentSrc ? currentSrc.split('/').pop() : 'No src'}
                </div>
            )}
        </div>
    );
};

export default LazyImage;