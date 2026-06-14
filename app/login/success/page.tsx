"use client";

import { useEffect } from "react";

export default function SuccessPage() {
  useEffect(() => {
    try {
      window.close();
    } catch (e) {
      console.error("Failed to close window", e);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6 font-sans">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
          <svg
            className="h-6 w-6 text-teal-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-bold text-gray-950">Successfully signed in!</h1>
        <p className="mt-2 text-sm text-gray-500">This popup will close automatically.</p>
      </div>
    </div>
  );
}
