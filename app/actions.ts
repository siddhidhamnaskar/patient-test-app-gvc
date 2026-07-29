"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { saveServiceUser, updateServiceUser, deleteServiceUser, getServiceUsers, ServiceUser } from "@/lib/service-user-store";

// Helper function to require authentication
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error("Unauthorized: Please sign in first.");
  }
  return session;
}

export async function createServiceUserAction(data: {
  name: string;
  dob?: string;
  nhsNumber?: string;
  clientRef?: string;
  gender?: string;
  notes?: string;
}) {
  try {
    const session = await requireAuth();

    // Required fields validation
    if (!data.name || !data.name.trim()) {
      return { success: false, error: "Name is required." };
    }

    // NHS number format validation (optional, but if provided, must be numbers/spaces and clean)
    const rawNhs = data.nhsNumber?.replace(/\s+/g, "") || "";
    if (rawNhs && !/^\d{10}$/.test(rawNhs)) {
      return { success: false, error: "NHS Number must be a 10-digit number." };
    }

    const newUser: ServiceUser = {
      id: "su_" + Date.now(),
      name: data.name.trim(),
      dob: data.dob || "",
      nhsNumber: data.nhsNumber?.trim() || "",
      clientRef: data.clientRef?.trim() || "",
      gender: data.gender || "Prefer not to say",
      notes: data.notes?.trim() || "",
      createdAt: new Date().toISOString(),
    };

    const saved = saveServiceUser(newUser);
    if (!saved) {
      return { success: false, error: "Failed to write data locally." };
    }

    revalidatePath("/");
    return { success: true, data: newUser };
  } catch (error: any) {
    console.error("Failed to create service user:", error);
    return { success: false, error: error.message || "Failed to create service user." };
  }
}

export async function updateServiceUserAction(data: {
  id: string;
  name: string;
  dob?: string;
  nhsNumber?: string;
  clientRef?: string;
  gender?: string;
  notes?: string;
}) {
  try {
    const session = await requireAuth();

    // Required fields validation
    if (!data.id) {
      return { success: false, error: "ID is required." };
    }
    if (!data.name || !data.name.trim()) {
      return { success: false, error: "Name is required." };
    }

    // NHS number format validation (optional, but if provided, must be numbers/spaces and clean)
    const rawNhs = data.nhsNumber?.replace(/\s+/g, "") || "";
    if (rawNhs && !/^\d{10}$/.test(rawNhs)) {
      return { success: false, error: "NHS Number must be a 10-digit number." };
    }

    const items = getServiceUsers();
    const existing = items.find(item => item.id === data.id);
    if (!existing) {
      return { success: false, error: "Service User not found." };
    }

    const updatedUser: ServiceUser = {
      ...existing,
      name: data.name.trim(),
      dob: data.dob || "",
      nhsNumber: data.nhsNumber?.trim() || "",
      clientRef: data.clientRef?.trim() || "",
      gender: data.gender || "Prefer not to say",
      notes: data.notes?.trim() || "",
    };

    const saved = updateServiceUser(updatedUser);
    if (!saved) {
      return { success: false, error: "Failed to write data locally." };
    }

    revalidatePath("/");
    return { success: true, data: updatedUser };
  } catch (error: any) {
    console.error("Failed to update service user:", error);
    return { success: false, error: error.message || "Failed to update service user." };
  }
}

export async function deleteServiceUserAction(id: string) {
  try {
    const session = await requireAuth();

    if (!id) {
      return { success: false, error: "ID is required." };
    }

    const deleted = deleteServiceUser(id);
    if (!deleted) {
      return { success: false, error: "Service User not found or failed to delete." };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete service user:", error);
    return { success: false, error: error.message || "Failed to delete service user." };
  }
}

