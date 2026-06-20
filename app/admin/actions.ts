"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Helper function to check if the session is admin or superadmin
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error("Unauthorized: Please sign in first.");
  }
  
  const role = session.user.role;
  if (role !== "superadmin" && role !== "admin") {
    throw new Error("Forbidden: You do not have administrator permissions.");
  }
  
  return session;
}

// Fetch all users
export async function getUsersAction() {
  await requireAdmin();
  try {
    const users = await db.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    return { success: true, data: users };
  } catch (error: any) {
    console.error("Failed to fetch users:", error);
    return { success: false, error: error.message || "Failed to load users." };
  }
}

// Create a new user
export async function createUserAction(data: { name: string; email: string; role: string }) {
  const session = await requireAdmin();
  
  if (!data.name || !data.email || !data.role) {
    return { success: false, error: "Name, email, and role are required." };
  }

  try {
    // Check if user already exists
    const existing = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      return { success: false, error: "A user with this email already exists." };
    }

    const newUser = await db.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        role: data.role,
        createdBy: session.user.email,
      },
    });

    revalidatePath("/admin");
    return { success: true, data: newUser };
  } catch (error: any) {
    console.error("Failed to create user:", error);
    return { success: false, error: error.message || "Failed to create user." };
  }
}

// Update an existing user
export async function updateUserAction(id: number, data: { name: string; email: string; role: string }) {
  await requireAdmin();

  if (!data.name || !data.email || !data.role) {
    return { success: false, error: "Name, email, and role are required." };
  }

  try {
    // Check if email is already taken by another user
    const existing = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing && existing.id !== id) {
      return { success: false, error: "This email is already in use by another user." };
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        role: data.role,
      },
    });

    revalidatePath("/admin");
    return { success: true, data: updatedUser };
  } catch (error: any) {
    console.error("Failed to update user:", error);
    return { success: false, error: error.message || "Failed to update user." };
  }
}

// Delete a user
export async function deleteUserAction(id: number) {
  const session = await requireAdmin();

  try {
    // Prevent self-deletion
    const userToDelete = await db.user.findUnique({
      where: { id },
    });

    if (!userToDelete) {
      return { success: false, error: "User not found." };
    }

    if (userToDelete.email.toLowerCase() === session.user?.email?.toLowerCase()) {
      return { success: false, error: "You cannot delete your own account." };
    }

    await db.user.delete({
      where: { id },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete user:", error);
    return { success: false, error: error.message || "Failed to delete user." };
  }
}
