import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import AdminDashboardClient from "./admin-dashboard-client";
import Link from "next/link";
import { getImagesMetadata, getQuestionsMetadata, getLevelsMetadata } from "@/lib/metadata-store";

export const metadata = {
  title: "Admin Panel | Test App",
  description: "Manage users, system access, and roles.",
};

export default async function AdminPage() {
  const session = await auth();

  // Redirect if not signed in or not an admin/superadmin
  if (!session || !session.user || (session.user.role !== "superadmin" && session.user.role !== "admin")) {
    redirect("/");
  }

  // Fetch initial users from MySQL using Prisma
  const users = await db.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  // Fetch initial local uploaded images metadata
  const images = getImagesMetadata();

  // Fetch initial questions metadata
  const questions = getQuestionsMetadata();

  // Fetch initial levels metadata
  const levels = getLevelsMetadata();



  // Serialize dates to prevent Next.js Client Component warnings
  const serializedUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdBy: user.createdBy,
    createdAt: user.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 font-sans">
      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="group flex h-9 w-9 items-center justify-center rounded-xl border border-gray-205 bg-white text-gray-600 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
              >
                <svg
                  className="h-5 w-5 transition-transform group-hover:-translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-950">
                Admin Panel
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-gray-500 pl-12">
               System access, user settings, roles, and administrative configuration.
            </p>
          </div>

          <div className="flex items-center gap-3 pl-12 sm:pl-0">
            <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-600/20">
              Active: {session.user.name} ({session.user.role})
            </span>
          </div>
        </div>

        {/* User & Settings Administration Dashboard */}
        <AdminDashboardClient
          initialUsers={serializedUsers}
          initialImages={images}
          initialQuestions={questions}
          initialLevels={levels}
          currentUserEmail={session.user.email}
        />
        
      </div>
    </div>
  );
}
