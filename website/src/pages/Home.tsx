import Hero from '../components/Hero';
import PropertyDemo from '../components/PropertyDemo';
import Demos from '../components/Demos';
import { FinalCta, HowItWorks, Platform, Pricing, Trust } from '../components/Sections';

export default function Home() {
  return (
    <main>
      <Hero />
      <PropertyDemo />
      <Platform />
      <div className="pt-12">
        <Demos />
      </div>
      <HowItWorks />
      <Trust />
      <Pricing />
      <FinalCta />
    </main>
  );
}
