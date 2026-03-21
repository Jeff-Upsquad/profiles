import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Navbar from '@/components/layout/Navbar';

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Find the{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Perfect Talent
              </span>
              <br />
              for Your Business
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
              SquadHire connects businesses with skilled professionals across
              accounting, design, video editing, and more. Create your profile
              or discover top talent today.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {user ? (
                <Link to={user.role === 'business' ? '/business/dashboard' : '/talent/dashboard'}>
                  <Button size="lg">Go to Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link to="/signup/talent">
                    <Button size="lg">Join as Talent</Button>
                  </Link>
                  <Link to="/signup/business">
                    <Button variant="outline" size="lg">
                      Hire Talent
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-100 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            How It Works
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Create Your Profile',
                description:
                  'Sign up as a talent and create profiles for your skills — accountant, designer, video editor, and more.',
              },
              {
                step: '2',
                title: 'Get Discovered',
                description:
                  'Once approved, your profile becomes visible to businesses looking for professionals like you.',
              },
              {
                step: '3',
                title: 'Connect & Get Hired',
                description:
                  'Businesses send interest requests and connect with you directly. Start working on exciting projects.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-600">
                  {item.step}
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA for businesses */}
      <section className="border-t border-gray-100 bg-indigo-600 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white">
            Looking to Hire?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100">
            Browse through vetted professionals, shortlist your favorites,
            and connect instantly. No middlemen.
          </p>
          <div className="mt-8">
            <Link to="/signup/business">
              <Button
                size="lg"
                className="bg-white text-indigo-600 hover:bg-indigo-50"
              >
                Sign Up as Business
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500 sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} SquadHire. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
