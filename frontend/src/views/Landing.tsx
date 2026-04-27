import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Navbar from '@/components/layout/Navbar';
import CategoriesSection from '@/components/sections/CategoriesSection';

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-20">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 sm:py-36 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-neutral-900 leading-[1.1]">
              The All-in-One Talent
              <br />
              Platform for{' '}
              <span className="italic text-neutral-500">Modern Brands</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-500 leading-relaxed">
              Access skilled professionals across designing, video editing, development,
              accounting, legal, and more — all in one place.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {user ? (
                <Link href="/dashboard">
                  <Button size="lg">
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/signup/talent">
                    <Button size="lg">
                      Join as Talent
                    </Button>
                  </Link>
                  <Link href="/signup/business">
                    <Button variant="outline" size="lg">
                      Discover Talent
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Value props */}
            <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-neutral-500">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-xs">✓</span>
                <span>Vetted professionals</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-xs">✓</span>
                <span>No contracts required</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-xs">✓</span>
                <span>Instant hiring</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-medium uppercase tracking-widest text-neutral-400 mb-3">
              Simple Process
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-neutral-900">
              How It Works
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                step: '01',
                icon: '👤',
                title: 'Create Your Profile',
                description:
                  'Sign up as a talent and create profiles for your skills — accountant, designer, video editor, and more.',
              },
              {
                step: '02',
                icon: '🔍',
                title: 'Get Discovered',
                description:
                  'Once approved, your profile becomes visible to businesses looking for professionals like you.',
              },
              {
                step: '03',
                icon: '🤝',
                title: 'Connect & Get Hired',
                description:
                  'Businesses send interest requests and connect with you directly. Start working on exciting projects.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl bg-white p-8 transition-all duration-300 hover:shadow-md"
              >
                <div className="mb-5 text-xs font-semibold tracking-widest text-neutral-400 uppercase">
                  Step {item.step}
                </div>
                <div className="mb-5 text-3xl">{item.icon}</div>
                <h3 className="mb-3 text-lg font-semibold text-neutral-900">
                  {item.title}
                </h3>
                <p className="text-sm text-neutral-500 leading-relaxed">
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
          <div className="rounded-3xl bg-neutral-900 px-8 py-16 sm:px-16 sm:py-20 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold text-white mb-4">
              Looking to Hire?
            </h2>
            <p className="mx-auto max-w-xl text-neutral-400 mb-8">
              Browse through vetted professionals, shortlist your favorites,
              and connect instantly. No middlemen, no hassles.
            </p>
            <Link href="/signup/business">
              <Button
                size="lg"
                className="bg-white text-neutral-900 hover:bg-neutral-100"
              >
                Start Hiring Today
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200/60 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center gap-2.5 mb-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-xs font-bold text-white">
                  SH
                </div>
                <span className="text-lg font-semibold text-neutral-900 tracking-tight">SquadHire</span>
              </Link>
              <p className="text-xs text-neutral-500 mb-3">Powered by UpSquad</p>
              <p className="text-sm text-neutral-500">
                Connecting businesses with skilled professionals.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">Platform</h4>
              <ul className="space-y-2.5 text-sm text-neutral-600">
                <li><Link href="#how-it-works" className="hover:text-neutral-900 transition-colors">How it Works</Link></li>
                <li><Link href="#categories" className="hover:text-neutral-900 transition-colors">Categories</Link></li>
                <li><Link href="/login" className="hover:text-neutral-900 transition-colors">Login</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">Company</h4>
              <ul className="space-y-2.5 text-sm text-neutral-600">
                <li><a href="#" className="hover:text-neutral-900 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-neutral-900 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-neutral-900 transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">Legal</h4>
              <ul className="space-y-2.5 text-sm text-neutral-600">
                <li><a href="#" className="hover:text-neutral-900 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-neutral-900 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-neutral-200/60 pt-8">
            <p className="text-center text-sm text-neutral-400">
              &copy; {new Date().getFullYear()} SquadHire. All rights reserved.
            </p>
            <p className="text-center text-xs text-neutral-400 mt-1">Powered by UpSquad</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
