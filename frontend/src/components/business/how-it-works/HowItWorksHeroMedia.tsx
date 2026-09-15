'use client';

import { useEffect, useRef, useState } from 'react';
import HowItWorksSpeedControl from './HowItWorksSpeedControl';

// Ported from the upsquad-site HeroMedia player: poster thumbnail + play
// overlay, language-gated autoplay, and playback-speed control. Supports
// YouTube, Vimeo, Loom, SquadClips embeds plus direct video files.

function isEmbedUrl(url: string): boolean {
  if (!url) return false;
  return /(?:youtube\.com|youtu\.be|vimeo\.com|loom\.com|clips\.squadhub\.in)/i.test(url);
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.replace('/', '') || null;
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch {
    return null;
  }
  return null;
}

function getPosterUrl(url: string): string | null {
  const id = youtubeId(url);
  if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  try {
    const u = new URL(url);
    if (u.hostname.includes('vimeo.com')) {
      const vid = u.pathname.split('/').filter(Boolean).pop();
      if (vid) return `https://vumbnail.com/${vid}.jpg`;
    }
  } catch {
    return null;
  }
  return null;
}

function toEmbed(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '');
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&enablejsapi=1`;
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&enablejsapi=1`;
      if (u.pathname.startsWith('/embed/')) return `${url}${url.includes('?') ? '&' : '?'}autoplay=1`;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
    if (u.hostname.includes('loom.com')) {
      if (u.pathname.includes('/embed/')) return `${url}${url.includes('?') ? '&' : '?'}autoplay=1`;
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return `https://www.loom.com/embed/${id}?autoplay=1`;
    }
    if (u.hostname.includes('clips.squadhub.in')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return `https://clips.squadhub.in/embed/${id}?autoplay=1`;
    }
  } catch {
    return url;
  }
  return url;
}

function PlayButton() {
  return (
    <span className="w-16 h-16 bg-white/95 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all ring-1 ring-black/10">
      <svg className="w-6 h-6 ml-0.5 text-[#0a0a0a]" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

function applyEmbedPlaybackRate(iframe: HTMLIFrameElement | null, url: string, rate: number) {
  if (!iframe?.contentWindow || !url) return;
  try {
    const host = new URL(url).hostname;
    if (host.includes('youtu.be') || host.includes('youtube.com')) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'setPlaybackRate', args: [rate] }),
        '*',
      );
    } else if (host.includes('vimeo.com')) {
      iframe.contentWindow.postMessage({ method: 'setPlaybackRate', value: rate }, '*');
    }
  } catch {
    // ignore invalid URLs / cross-origin failures
  }
}

function supportsCustomSpeed(url: string): boolean {
  if (!url) return false;
  if (!isEmbedUrl(url)) return true;
  return /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(url);
}

export default function HowItWorksHeroMedia({
  videoUrl,
  previewUrl,
  onRequestGate,
  autoPlay = false,
}: {
  videoUrl?: string;
  previewUrl?: string;
  onRequestGate?: () => boolean;
  autoPlay?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);
  const [embedActive, setEmbedActive] = useState(false);
  const [rate, setRate] = useState(1);
  const source = videoUrl || previewUrl || '';
  const poster = source ? getPosterUrl(source) : null;
  const embed = isEmbedUrl(source);
  const showSpeed = supportsCustomSpeed(videoUrl || source);

  const startPlayback = (url: string) => {
    if (!url) return;
    if (isEmbedUrl(url)) {
      setEmbedActive(true);
      setPlaying(true);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    setPlaying(false);
    setEmbedActive(false);
  }, [videoUrl, previewUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
  }, [rate, videoUrl, playing]);

  useEffect(() => {
    if (!embedActive) return;
    applyEmbedPlaybackRate(iframeRef.current, videoUrl || source, rate);
  }, [rate, embedActive, videoUrl, source]);

  useEffect(() => {
    if (!autoPlay || !videoUrl || playing || embedActive) return;
    startPlayback(videoUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, videoUrl]);

  const handlePlayClick = () => {
    if (onRequestGate && !onRequestGate()) return;
    startPlayback(videoUrl || source);
  };

  const showFrame = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (playing) return;
    const v = e.currentTarget;
    if (v.currentTime < 0.05) {
      try {
        v.currentTime = 0.15;
      } catch {
        /* ignore */
      }
    }
  };

  if (!source) {
    if (onRequestGate) {
      return (
        <button
          type="button"
          onClick={() => onRequestGate()}
          aria-label="Play walkthrough video"
          className="relative w-full aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-[#1C1C1F] to-[#0A0A0A] flex items-center justify-center group"
        >
          <PlayButton />
          <span className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/80">
            Click play to choose a language
          </span>
        </button>
      );
    }
    return (
      <div className="w-full aspect-video rounded-2xl bg-[#f0f0f0] animate-pulse" aria-label="Video loading" />
    );
  }

  if (embed && embedActive) {
    return (
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black">
        <iframe
          ref={iframeRef}
          src={toEmbed(videoUrl || source)}
          title="How it works video"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          onLoad={() => applyEmbedPlaybackRate(iframeRef.current, videoUrl || source, rate)}
          className="w-full h-full"
        />
        {showSpeed && (
          <HowItWorksSpeedControl
            rate={rate}
            onChange={setRate}
            menuPlacement="down"
            className="absolute top-3 right-3 z-10"
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#0A0A0A]">
      {embed ? (
        poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1C1C1F] to-[#0A0A0A]" />
        )
      ) : (
        <video
          ref={videoRef}
          src={videoUrl || source}
          playsInline
          preload="metadata"
          poster={poster || undefined}
          controls={playing}
          onLoadedMetadata={(e) => {
            e.currentTarget.playbackRate = rate;
            showFrame(e);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {!playing && (
        <button
          type="button"
          onClick={handlePlayClick}
          aria-label="Play walkthrough video"
          className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition-colors"
        >
          <PlayButton />
        </button>
      )}

      {playing && showSpeed && (
        <HowItWorksSpeedControl
          rate={rate}
          onChange={setRate}
          menuPlacement="down"
          className="absolute top-3 right-3 z-10"
        />
      )}
    </div>
  );
}
