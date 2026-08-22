'use client';

import { useState } from 'react';

const SHARE_TEXT = 'Every .lol bid site, ranked by its own top bid';

export function ShareButton({ url }: { url: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const share = async () => {
    // Native sheet on mobile, clipboard everywhere else.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'topofthe.lol', text: SHARE_TEXT, url });
        return;
      } catch {
        // Dismissed or unsupported — fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2000);
  };

  return (
    <button type="button" onClick={share} className="brut-btn bg-card px-5 py-3 text-[13px]">
      {state === 'copied' ? 'Link copied' : state === 'failed' ? 'Copy failed' : 'Share this page'}
    </button>
  );
}
