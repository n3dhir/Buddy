import Architecture from "../components/landing/Architecture";
import Closing from "../components/landing/Closing";
import Features from "../components/landing/Features";
import Hero from "../components/landing/Hero";
import Nav from "../components/landing/Nav";
import Screenshot from "../components/landing/Screenshot";

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Nav />
      <main className="pb-8">
        <Hero />
        <Screenshot />
        <Architecture />
        <Features />
        <Closing />
      </main>
    </div>
  );
}
