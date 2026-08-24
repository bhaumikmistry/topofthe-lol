import { updatedAt } from '@/lib/site-data';

export function Footer({ count }: { count: number }) {
  return (
    <footer className="brut mt-12 border-x-0 border-b-0">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] font-bold uppercase tracking-[0.04em]">
          <span>{count} sites tracked</span>
          <nav className="flex flex-wrap gap-5">
            <a
              href="https://github.com/bhaumikmistry/topofthe-lol/issues/new?template=add-site.yml"
              target="_blank"
              rel="noopener noreferrer"
            >
              Add a site
            </a>
            <a
              href="https://github.com/bhaumikmistry/topofthe-lol"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source
            </a>
            <a
              href="https://github.com/shadcn-labs/outbid-template"
              target="_blank"
              rel="noopener noreferrer"
            >
              Build your own
            </a>
          </nav>
        </div>
        <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground">
          Bids refresh every 30 minutes, read straight off each site&rsquo;s own public board. These
          are the numbers those sites publish, not verified payments. Nobody paid to be on this
          page and there is nothing to buy here.
          {updatedAt
            ? ` Last refresh: ${new Date(updatedAt).toLocaleString('en-US', {
                timeZone: 'America/New_York',
                dateStyle: 'medium',
                timeStyle: 'short',
              })} ET.`
            : ''}
        </p>
      </div>
    </footer>
  );
}
