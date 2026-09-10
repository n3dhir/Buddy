import { Link } from "react-router";
import logoUrl from "../../assets/logo.svg";

export default function Nav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-hairline bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logoUrl} alt="Buddy logo" className="h-7 w-7 rounded-lg" />
          <span className="text-sm font-medium text-ink">Buddy</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm text-ink-subtle md:flex">
          <a href="#product" className="hover:text-ink">Product</a>
          <a href="#architecture" className="hover:text-ink">Architecture</a>
          <a href="#stack" className="hover:text-ink">Stack</a>
        </div>
        <Link
          to="/register"
          className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          Try the live app
        </Link>
      </div>
    </nav>
  );
}
