import { auth, signOut } from "@/auth";
import LoginPage from "./login/page";
import Link from "next/link";
import { getImagesMetadata } from "@/lib/metadata-store";
import { formatUTCDate } from "@/lib/date-utils";

export const metadata = {
  title: "Home | Test App",
  description: "Welcome to Test App",
};

export default async function Home() {
  const session = await auth();

  // If the user is not authenticated, show the login page content directly at the root '/'
  if (!session) {
    return <LoginPage />;
  }

  // Fetch initial local uploaded images metadata
  const images = getImagesMetadata();

  // If authenticated, show a clean welcome dashboard page along with the shared repository
  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-gray-50 py-12 px-6 font-sans gap-8">
      
      {/* Welcome & Profile Card */}
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-gray-100 text-center">
        {session.user?.image && (
          <img
            src={session.user.image}
            alt={session.user.name || "User Profile"}
            className="mx-auto h-20 w-20 rounded-full ring-4 ring-teal-500/20 shadow-md object-cover"
          />
        )}
        <h1 className="mt-6 text-2xl font-bold text-gray-900">
          Welcome back, {session.user?.name || "User"}!
        </h1>
        <p className="mt-2 text-sm text-gray-500">{session.user?.email}</p>
        
        {session.user?.role && (
          <span className="mt-3 inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">
            Role: {session.user.role}
          </span>
        )}

        {(session.user?.role === "superadmin" || session.user?.role === "admin") && (
          <div className="mt-5">
            <Link
              href="/admin"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-3.5 text-sm font-semibold text-white shadow-md hover:from-teal-500 hover:to-teal-400 hover:shadow-lg transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
              <svg
                className="h-4.5 w-4.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Go to Admin Panel
            </Link>
          </div>
        )}

        <div className="mt-8 border-t border-gray-100 pt-6">
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-500 transition-colors duration-200 active:scale-[0.98] cursor-pointer"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>

      {/* Shared Image Gallery Card */}
      <div className="w-full max-w-4xl rounded-2xl bg-white p-8 shadow-xl border border-gray-100">
        <div className="border-b border-gray-100 pb-4 mb-6">
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Shared Images Repository
          </h2>
          <p className="text-sm text-gray-500 mt-1">Locally stored image assets accessible by all authenticated users.</p>
        </div>

        {images.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {images.map((image) => (
              <div key={image.id} className="group overflow-hidden rounded-xl border border-gray-150 bg-white shadow-sm hover:shadow-md transition-all">
                <div className="aspect-video relative overflow-hidden bg-gray-100">
                  <img
                    src={image.url}
                    alt={image.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <h4 className="font-bold text-gray-900 truncate" title={image.name}>
                    {image.name}
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-1 truncate">
                    Uploaded by: {image.uploadedBy}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Uploaded: {formatUTCDate(image.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
            <svg className="mx-auto h-12 w-12 text-gray-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-sm font-semibold">No shared images available</p>
            <p className="text-xs text-gray-400 mt-1">Administrators can upload images through the Admin Panel settings.</p>
          </div>
        )}
      </div>

    </div>
  );
}
