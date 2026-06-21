"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { saveImageMetadata, updateImageName, getImagesMetadata, ImageMetadata } from "@/lib/metadata-store";

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

// --- Image Management Server Actions ---

// Upload multiple images and store them locally
export async function uploadImagesAction(formData: FormData) {
  const session = await requireAdmin();

  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    return { success: false, error: "At least one image file is required." };
  }

  const uploadedItems: ImageMetadata[] = [];

  try {
    // Upload Path
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size === 0) continue;

      // Validate it is an image
      if (!file.type.startsWith("image/")) {
        return { success: false, error: `File "${file.name}" must be an image (PNG, JPEG, etc).` };
      }

      // Generate unique ID and filename (append index to prevent millisecond collision)
      const id = "img_" + Date.now() + "_" + i;
      const originalName = file.name;
      const extension = originalName.includes(".") ? originalName.split(".").pop() : "png";
      const filename = `${id}.${extension}`;
      const filePath = path.join(uploadsDir, filename);

      // Save file buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);

      // Clean name: use original filename without its extension
      const defaultName = originalName.includes(".")
        ? originalName.substring(0, originalName.lastIndexOf("."))
        : originalName;

      const imageItem: ImageMetadata = {
        id,
        name: defaultName,
        url: `/uploads/${filename}`,
        uploadedBy: session.user.email || "Unknown Admin",
        createdAt: new Date().toISOString(),
      };

      // Save metadata
      saveImageMetadata(imageItem);
      uploadedItems.push(imageItem);
    }

    // Revalidate routes
    revalidatePath("/admin");
    revalidatePath("/");

    return { success: true, data: uploadedItems };
  } catch (error: any) {
    console.error("Failed to upload images:", error);
    return { success: false, error: error.message || "Failed to save files locally." };
  }
}

// Edit the name label of an uploaded image
export async function updateImageNameAction(id: string, name: string) {
  await requireAdmin();

  if (!id || !name.trim()) {
    return { success: false, error: "Image ID and a valid Name are required." };
  }

  try {
    const success = updateImageName(id, name);
    if (!success) {
      return { success: false, error: "Image metadata record not found." };
    }

    revalidatePath("/admin");
    revalidatePath("/");

    return { success: true };
  } catch (error: any) {
    console.error("Failed to update image name:", error);
    return { success: false, error: error.message || "Failed to update image name." };
  }
}

// Fetch all uploaded images metadata (can be called server side directly too)
export async function getImagesAction() {
  await requireAdmin();
  try {
    const items = getImagesMetadata();
    return { success: true, data: items };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch images list." };
  }
}
