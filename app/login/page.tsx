import Image from "next/image";
import GoogleSignInButton from "./google-button";

export const metadata = {
  title: "Sign In | Test App",
  description: "Sign in to Test App with your Google account.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full">
      {/* Left side - illustration */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-teal-600 to-blue-700 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.1),transparent_50%)]" />

        <div className="relative z-10 px-8 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">Test App</span>
          </div>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center px-8 min-h-0">
          <Image
            src="/app3001/medical-illustration.svg"
            alt="Healthcare illustration"
            width={560}
            height={300}
            className="max-w-full h-auto max-h-[400px] object-contain drop-shadow-2xl"
            priority
          />
        </div>

        <div className="relative z-10 px-8 pb-6">
          <blockquote className="max-w-full text-white/90">
            <p className="text-lg font-medium leading-relaxed">
              &ldquo;Caring for every little hero with kindness, safety, and
              smiles.&rdquo;
            </p>
          </blockquote>
        </div>
      </div>

      {/* Right side - login panel */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-6 lg:w-1/2">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-blue-700 text-white">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">Test App</span>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Welcome back
            </h1>
            <p className="mt-3 text-base text-gray-500">
              A safe, friendly place for your child&apos;s health tests and
              reports.
            </p>
          </div>

          <div className="space-y-4">
            <GoogleSignInButton />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-4 text-gray-400">
                  Secure sign-in
                </span>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400">
              By continuing, you agree to our{" "}
              <a
                href="#"
                className="text-teal-600 hover:text-teal-700 hover:underline"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="#"
                className="text-teal-600 hover:text-teal-700 hover:underline"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
