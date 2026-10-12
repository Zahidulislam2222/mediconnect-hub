import { useEffect, useState } from 'react';
import { cmsApi } from '@/lib/api';

/** Fetch media through the CMS boundary; only temporary local blobs reach img. */
export function CmsImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [image, setImage] = useState<{ source: string; url: string }>();
  useEffect(() => {
    let active = true;
    let ownedUrl: string | undefined;
    const controller = new AbortController();
    cmsApi.media(src, { signal: controller.signal }).then(blob => {
      if (!active) return;
      ownedUrl = URL.createObjectURL(blob);
      setImage({ source: src, url: ownedUrl });
    }).catch(() => { /* Unavailable/redirected media is never embedded. */ });
    return () => {
      active = false;
      controller.abort();
      if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    };
  }, [src]);
  return image?.source === src ? <img src={image.url} alt={alt} className={className} /> : null;
}
