import { updatedAt } from '@/lib/site-data';

export function Footer({ count }: { count: number }) {
  return (
    <footer className="mt-auto">
      <div className="mx-auto max-w-3xl px-4 py-10 text-xs text-muted-foreground">
        <p>
          {count} sites tracked. Bids refresh every 30 minutes from each site&rsquo;s own public
          board. Numbers are what those sites report, not verified payments.
        </p>
        <p className="mt-2">
          Missing a site?{' '}
          <a
            href="https://github.com/bhaumikmistry/topofthe-lol"
            className="underline hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open a pull request
          </a>{' '}
          adding one line to <code className="font-mono">data/sites.json</code>.
          {updatedAt ? ` Last refresh: ${new Date(updatedAt).toUTCString()}.` : ''}
        </p>
      </div>
    </footer>
  );
}
