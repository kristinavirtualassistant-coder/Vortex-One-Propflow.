import { Link } from 'react-router-dom';
import { Nav } from '../components/Layout';
import { btnPrimary } from '../components/ui';

export default function NotFound() {
  return (
    <>
      <header className="bg-navy px-6">
        <div className="mx-auto max-w-6xl">
          <Nav />
        </div>
      </header>
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.15em] text-ink-3">404</p>
        <h1 className="m-0 text-4xl font-black tracking-tight">That page is not here</h1>
        <p className="m-0 max-w-md text-base leading-6 text-ink-2">The link may be old or mistyped. Head back to the home page.</p>
        <Link to="/" className={btnPrimary}>Back to home</Link>
      </main>
    </>
  );
}
