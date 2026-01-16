import Link from "next/link";
import ButtonSignin from "@/components/ButtonSignin";

export default function Page() {
  return (
    <>
      <header className="p-4 flex justify-end max-w-7xl mx-auto">
        <ButtonSignin text="Login" />
      </header>
      <main>
        <section className="flex flex-col items-center justify-center text-center gap-12 px-8 py-24">
          <h1 className="text-3xl font-extrabold">Ship Fast ⚡️</h1>

          <p className="text-lg opacity-80">
            The start of your new startup... What are you gonna build?
          </p>

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
            <Link href="/strategies" className="block group">
              <div className="card bg-gradient-to-br from-primary/20 to-primary/5 hover:from-primary/30 hover:to-primary/10 transition-all duration-200 card-border group-hover:shadow-lg">
                <div className="card-body">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-4xl">📈</div>
                    <div className="badge badge-primary badge-sm">Public</div>
                  </div>
                  <h2 className="card-title text-2xl mb-2">Trading Strategies</h2>
                  <p className="text-base-content/70">
                    Proven strategies with backtested results, risk management frameworks, and real-world performance tracking.
                  </p>
                  <div className="card-actions justify-end mt-4">
                    <span className="text-sm text-primary group-hover:underline inline-flex items-center gap-1 font-semibold">
                      Explore Strategies
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/reports" className="block group">
              <div className="card bg-base-200 hover:bg-base-300 transition-all duration-200 card-border group-hover:shadow-lg">
                <div className="card-body">
                  <div className="text-4xl mb-3">📊</div>
                  <h2 className="card-title text-2xl mb-2">Trading Reports</h2>
                  <p className="text-base-content/70">
                    View detailed weekly and monthly trading performance reports with R-multiples and strategy breakdowns.
                  </p>
                  <div className="card-actions justify-end mt-4">
                    <span className="text-sm text-primary group-hover:underline inline-flex items-center gap-1">
                      View Reports
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/portfolio" className="block group">
              <div className="card bg-base-200 hover:bg-base-300 transition-all duration-200 card-border group-hover:shadow-lg">
                <div className="card-body">
                  <div className="text-4xl mb-3">💼</div>
                  <h2 className="card-title text-2xl mb-2">Portfolio Performance</h2>
                  <p className="text-base-content/70">
                    Track weekly and cumulative performance across all 6 trading strategies with detailed analytics.
                  </p>
                  <div className="card-actions justify-end mt-4">
                    <span className="text-sm text-primary group-hover:underline inline-flex items-center gap-1">
                      View Portfolio
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          <a
            className="btn btn-primary"
            href="https://shipfa.st/docs"
            target="_blank"
          >
            Documentation & tutorials{" "}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M5 10a.75.75 0 01.75-.75h6.638L10.23 7.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 11-1.04-1.08l2.158-1.96H5.75A.75.75 0 015 10z"
                clipRule="evenodd"
              />
            </svg>
          </a>

          <Link href="/blog" className="link link-hover text-sm">
            Fancy a blog?
          </Link>
        </section>
      </main>
    </>
  );
}
