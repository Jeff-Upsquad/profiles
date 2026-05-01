import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import CategoriesSection from '@/components/sections/CategoriesSection';

const ArrowIcon = () => (
  <svg
    className="arrow-icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="hero-container hero-glow-orange relative pt-20">
        <div className="hero-glow-blur" aria-hidden />
        <div className="hero-content mx-auto max-w-7xl px-4 py-28 sm:px-6 sm:py-36 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="cu-lift mb-6 inline-flex">
              <span className="eyebrow-rainbow">
                New · The all-in-one talent platform
              </span>
            </div>

            <h1 className="display-hero text-cu-900 stagger-1">
              The All-in-One Talent
              <br />
              Platform for{' '}
              <span className="text-rainbow">Modern Brands</span>
            </h1>

            <p className="font-ui mx-auto mt-6 max-w-2xl text-lg text-cu-600 leading-relaxed stagger-2">
              Access skilled professionals across designing, video editing,
              development, accounting, legal, and more — all in one place.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row stagger-3">
              {user ? (
                <Link href="/dashboard">
                  <button className="btn-iridescent">
                    Go to Dashboard
                    <ArrowIcon />
                  </button>
                </Link>
              ) : (
                <>
                  <Link href="/signup/talent">
                    <button className="btn-iridescent">
                      Join as Talent
                      <ArrowIcon />
                    </button>
                  </Link>
                  <Link href="/signup/business">
                    <button className="btn-v5 btn-v5-secondary btn-v5-lg">
                      Discover Talent
                    </button>
                  </Link>
                </>
              )}
            </div>

            {/* Value props */}
            <div className="mt-16 flex flex-wrap items-center justify-center gap-3 stagger-4">
              <span className="eyebrow-rainbow">Vetted professionals</span>
              <span className="eyebrow-rainbow">No contracts required</span>
              <span className="eyebrow-rainbow">Instant hiring</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="font-ui text-xs uppercase tracking-[0.14em] text-iris-500 font-semibold mb-3">
              Simple Process
            </p>
            <h2 className="display-xl text-cu-900">How It Works</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                step: '01',
                tint: 'tint-purple',
                stagger: 'stagger-1',
                title: 'Create Your Profile',
                description:
                  'Sign up as a talent and create profiles for your skills — accountant, designer, video editor, and more.',
                icon: (
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                ),
              },
              {
                step: '02',
                tint: 'tint-orange',
                stagger: 'stagger-2',
                title: 'Get Discovered',
                description:
                  'Once approved, your profile becomes visible to businesses looking for professionals like you.',
                icon: (
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                ),
              },
              {
                step: '03',
                tint: 'tint-green',
                stagger: 'stagger-3',
                title: 'Connect & Get Hired',
                description:
                  'Businesses send interest requests and connect with you directly. Start working on exciting projects.',
                icon: (
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 11l-3 3-3-3" />
                    <path d="M19 14V4" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.step}
                className={`stat-card ${item.tint} ${item.stagger}`}
              >
                <div
                  className="font-ui mb-5 text-xs font-semibold uppercase tracking-[0.14em]"
                  style={{ color: 'var(--tint-text)' }}
                >
                  Step {item.step}
                </div>
                <div
                  className="mb-5"
                  style={{ color: 'var(--tint-icon)' }}
                >
                  {item.icon}
                </div>
                <h3 className="mb-3 text-lg font-semibold text-cu-900">
                  {item.title}
                </h3>
                <p className="font-ui text-sm text-cu-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <CategoriesSection />

      {/* CTA for businesses */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="border-conic">
            <div className="relative overflow-hidden rounded-[18px] bg-cu-950 px-8 py-16 sm:px-16 sm:py-20 text-center noise-overlay">
              <h2 className="display-xl text-white mb-4">Looking to Hire?</h2>
              <p className="font-ui mx-auto max-w-xl text-cu-400 mb-8">
                Browse through vetted professionals, shortlist your favorites,
                and connect instantly. No middlemen, no hassles.
              </p>
              <Link href="/signup/business">
                <button className="btn-iridescent">
                  Start Hiring Today
                  <ArrowIcon />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-cu-200 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center gap-2.5 mb-1">
                <div className="bg-rainbow flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm">
                  SH
                </div>
                <span className="text-lg font-semibold text-cu-900 tracking-tight">
                  SquadHire
                </span>
              </Link>
              <p className="text-xs text-cu-500 mb-3">Powered by UpSquad</p>
              <p className="font-ui text-sm text-cu-600">
                Connecting businesses with skilled professionals.
              </p>
            </div>

            <div>
              <h4 className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-iris-500 mb-4">
                Platform
              </h4>
              <ul className="space-y-2.5 text-sm text-cu-600">
                <li>
                  <Link href="#how-it-works" className="hover:text-cu-900 transition-colors">
                    How it Works
                  </Link>
                </li>
                <li>
                  <Link href="#categories" className="hover:text-cu-900 transition-colors">
                    Categories
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-cu-900 transition-colors">
                    Login
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-iris-500 mb-4">
                Company
              </h4>
              <ul className="space-y-2.5 text-sm text-cu-600">
                <li>
                  <a href="#" className="hover:text-cu-900 transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-cu-900 transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-cu-900 transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-iris-500 mb-4">
                Legal
              </h4>
              <ul className="space-y-2.5 text-sm text-cu-600">
                <li>
                  <a href="#" className="hover:text-cu-900 transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-cu-900 transition-colors">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-cu-200 pt-8">
            <p className="text-center text-sm text-cu-500">
              &copy; {new Date().getFullYear()} SquadHire. All rights reserved.
            </p>
            <p className="text-center text-xs text-cu-500 mt-1">
              Powered by UpSquad
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
