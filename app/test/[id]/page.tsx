import { auth } from "@/auth";
import LoginPage from "@/app/login/page";
import { getServiceUserById } from "@/lib/service-user-store";
import { getLevelsMetadata, getImagesMetadata, getQuestionsMetadata } from "@/lib/metadata-store";
import TestPortalClient from "./test-portal-client";

interface TestPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TestPage({ params }: TestPageProps) {
  const session = await auth();
  if (!session || !session.user) {
    return <LoginPage />;
  }

  const { id } = await params;
  const serviceUser = getServiceUserById(id);

  if (!serviceUser) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center font-sans">
        <div className="rounded-2xl bg-white p-8 shadow-xl border border-gray-100 max-w-md space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Service User Not Found</h2>
          <p className="text-sm text-gray-500">
            The service user you are trying to test does not exist or has been removed from the local store.
          </p>
          <a
            href="/"
            className="inline-flex w-full justify-center rounded-xl bg-teal-650 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 active:scale-95 transition-all"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const levels = getLevelsMetadata();
  const images = getImagesMetadata();
  const questions = getQuestionsMetadata();

  // Serialize levels to avoid warnings about passing class instances if any
  const serializedLevels = levels.map((lvl) => ({
    id: lvl.id,
    name: lvl.name,
    order: lvl.order,
    screens: lvl.screens?.map((scr) => ({
      id: scr.id,
      name: scr.name,
      order: scr.order,
      imageId: scr.imageId,
      imageIds: scr.imageIds,
      questionId: scr.questionId,
      questionIds: scr.questionIds,
      voiceRecordEnabled: scr.voiceRecordEnabled,
      voicePromptUrls: scr.voicePromptUrls,
    })) || [],
  }));

  return (
    <TestPortalClient
      serviceUser={serviceUser}
      initialLevels={serializedLevels}
      images={images}
      questions={questions}
    />
  );
}

