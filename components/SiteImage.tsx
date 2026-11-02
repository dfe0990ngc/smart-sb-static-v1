'use client';

import { useEffect, useState } from 'react';
import { assetUrl } from '../lib/assets';

type Props = {
  src?: string | null;
  alt: string;
  fallback: string;
  className?: string;
};

/** <img> that resolves JSON paths and falls back to a bundled placeholder if the file is missing. */
export default function SiteImage({ src, alt, fallback, className }: Props) {
  const resolved = assetUrl(src, fallback);
  const [current, setCurrent] = useState(resolved);

  useEffect(() => setCurrent(resolved), [resolved]);

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => current !== fallback && setCurrent(fallback)}
    />
  );
}
