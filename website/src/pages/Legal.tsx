import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Nav } from '../components/Layout';
import { Eyebrow } from '../components/ui';
import { findDoc } from '../content/legal';
import NotFound from './NotFound';

export default function Legal() {
  const { slug } = useParams();
  const doc = findDoc(slug);

  useEffect(() => {
    if (doc) document.title = `${doc.title} | Vortex One`;
    return () => {
      document.title = 'Vortex One | Property intelligence, CRM and dialer';
    };
  }, [doc]);

  if (!doc) return <NotFound />;

  return (
    <>
      <Nav />
      <main id="main" className="px-6 pb-24 pt-16">
        <article className="mx-auto flex max-w-3xl flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Eyebrow>Legal</Eyebrow>
            <h1 className="m-0 text-4xl font-black leading-10 tracking-tight">{doc.title}</h1>
            <p className="m-0 text-sm text-ink-3">Last updated {doc.updated}</p>
            {doc.intro && <p className="m-0 pt-2 text-base leading-6 text-ink-2">{doc.intro}</p>}
          </div>
          {doc.sections.map((s) => (
            <section key={s.h} className="flex flex-col gap-3">
              <h2 className="m-0 text-2xl font-bold leading-8">{s.h}</h2>
              {s.p?.map((t, i) => (
                <p key={i} className="m-0 text-base leading-[1.65] text-ink-2">{t}</p>
              ))}
              {s.li && (
                <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-base leading-[1.65] text-ink-2">
                  {s.li.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </main>
    </>
  );
}
