import { auth, signOut } from "@/auth";
import LoginPage from "./login/page";

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

  // If authenticated, show a clean welcome dashboard page
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 font-sans">
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
    </div>
  );
}
