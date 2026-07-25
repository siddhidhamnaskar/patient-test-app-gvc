import { auth } from "@/auth";
import LoginPage from "./login/page";
import HomeDashboardClient from "./home-dashboard-client";
import { getServiceUsers } from "@/lib/service-user-store";

export const metadata = {
  title: "Home | Clinical Assessment Portal",
  description: "Manage service users and perform diagnostic tests.",
};

export default async function Home() {
  const session = await auth();

  // If the user is not authenticated, show the login page content directly at the root '/'
  if (!session || !session.user) {
    return <LoginPage />;
  }

  // Fetch initial local service users
  const serviceUsers = getServiceUsers();

  return (
    <HomeDashboardClient
      initialServiceUsers={serviceUsers}
      currentUser={session.user}
    />
  );
}

