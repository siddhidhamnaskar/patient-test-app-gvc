"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import {
  saveImageMetadata,
  updateImageName,
  getImagesMetadata,
  ImageMetadata,
  saveQuestionMetadata,
  getQuestionsMetadata,
  saveQuestionsMetadata,
  QuestionMetadata,
  saveLevelsMetadata,
  LevelMetadata,
} from "@/lib/metadata-store";

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
        url: `/app3001/uploads/${filename}`,
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

// Fetch all uploaded images metadata
export async function getImagesAction() {
  await requireAdmin();
  try {
    const items = getImagesMetadata();
    return { success: true, data: items };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch images list." };
  }
}

// --- Question Management Server Actions ---

// Parse helper for CSV format
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [""];
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

// Create a new question manually and store it locally
export async function createQuestionAction(data: { text: string }) {
  await requireAdmin();

  if (!data.text) {
    return { success: false, error: "Question text is required." };
  }

  const text = data.text.trim();

  try {
    const id = "q_" + Date.now();
    const questionItem: QuestionMetadata = {
      id,
      text,
    };

    saveQuestionMetadata(questionItem);

    // Revalidate routes
    revalidatePath("/admin");
    revalidatePath("/");

    return { success: true, data: questionItem };
  } catch (error: any) {
    console.error("Failed to save question:", error);
    return { success: false, error: error.message || "Failed to save question locally." };
  }
}

// Import questions from a CSV file
export async function importQuestionsCSVAction(formData: FormData) {
  await requireAdmin();

  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, error: "No CSV file uploaded." };
  }

  try {
    const content = await file.text();
    const parsedRows = parseCSV(content);

    if (parsedRows.length < 2) {
      return { success: false, error: "CSV file must contain a header row and at least one question row." };
    }

    const headers = parsedRows[0].map(h => h.trim().toLowerCase());
    
    // Find columns using header matching
    // Look for Question ID
    let idIndex = headers.findIndex(h => h.includes("id") || h.includes("key") || h.includes("code"));
    if (idIndex === -1) idIndex = 0; // Default to first column

    // Look for Question Text / heading
    let textIndex = headers.findIndex(h => h.includes("text") || h.includes("question") || h.includes("heading") || h.includes("content"));
    if (textIndex === -1) {
      textIndex = idIndex === 0 ? 1 : 0; // Default to second column
    }

    const importedQuestions: QuestionMetadata[] = [];
    const errors: string[] = [];

    // Parse data rows
    for (let r = 1; r < parsedRows.length; r++) {
      const row = parsedRows[r];
      // Skip empty rows
      if (row.length === 0 || (row.length === 1 && row[0].trim() === "")) {
        continue;
      }

      const rawId = row[idIndex];
      const rawText = row[textIndex];

      if (!rawId || !rawId.trim()) {
        errors.push(`Row ${r + 1}: Question ID is missing.`);
        continue;
      }
      if (!rawText || !rawText.trim()) {
        errors.push(`Row ${r + 1}: Question text is missing.`);
        continue;
      }

      const id = rawId.trim();
      const text = rawText.trim();

      if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        errors.push(`Row ${r + 1}: Question ID "${id}" contains invalid characters.`);
        continue;
      }

      importedQuestions.push({ id, text });
    }

    if (errors.length > 0 && importedQuestions.length === 0) {
      return { success: false, error: "Failed to parse CSV questions:\n" + errors.slice(0, 5).join("\n") };
    }

    if (importedQuestions.length === 0) {
      return { success: false, error: "No valid questions found in the CSV." };
    }

    // Save/Merge
    saveQuestionsMetadata(importedQuestions);

    revalidatePath("/admin");
    revalidatePath("/");

    return { 
      success: true, 
      message: `Successfully imported/merged ${importedQuestions.length} questions.`,
      warning: errors.length > 0 ? `Skipped ${errors.length} invalid rows:\n` + errors.slice(0, 5).join("\n") : undefined
    };
  } catch (error: any) {
    console.error("Failed to import CSV:", error);
    return { success: false, error: error.message || "An error occurred while importing CSV." };
  }
}

// Fetch all questions
export async function getQuestionsAction() {
  await requireAdmin();
  try {
    const items = getQuestionsMetadata();
    return { success: true, data: items };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch questions list." };
  }
}

// Save all test levels
export async function saveLevelsAction(levels: LevelMetadata[]) {
  await requireAdmin();
  try {
    const success = saveLevelsMetadata(levels);
    if (!success) {
      return { success: false, error: "Failed to save levels metadata." };
    }
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to save levels:", error);
    return { success: false, error: error.message || "Failed to save levels." };
  }
}

// Upload a voice prompt recording locally
export async function uploadVoicePromptAction(formData: FormData) {
  await requireAdmin();

  const file = formData.get("file") as File;
  const levelId = formData.get("levelId") as string;
  const screenId = formData.get("screenId") as string;
  const slotIndexStr = formData.get("slotIndex") as string;

  if (!file) {
    return { success: false, error: "Audio file is required." };
  }
  if (!levelId || !screenId || slotIndexStr === undefined) {
    return { success: false, error: "Missing levelId, screenId, or slotIndex." };
  }

  const slotIndex = parseInt(slotIndexStr, 10);

  try {
    const recordingsDir = path.join(process.cwd(), "public", "recordings");
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }

    // Generate unique name per level, screen, slot to avoid conflicts, appending timestamp
    const filename = `lvl_${levelId}_scr_${screenId}_slot_${slotIndex}_${Date.now()}.webm`;
    const filePath = path.join(recordingsDir, filename);

    // Save file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/app3001/recordings/${filename}`;

    return { success: true, url: relativeUrl };
  } catch (error: any) {
    console.error("Failed to upload voice prompt:", error);
    return { success: false, error: error.message || "Failed to save audio file locally." };
  }
}

// Delete a voice prompt recording file locally
export async function deleteVoicePromptAction(relativeUrl: string) {
  await requireAdmin();

  let cleanUrl = relativeUrl;
  if (cleanUrl.startsWith("/app3001/")) {
    cleanUrl = cleanUrl.replace("/app3001", "");
  }

  if (!cleanUrl || !cleanUrl.startsWith("/recordings/")) {
    return { success: false, error: "Invalid recording path." };
  }

  try {
    const filePath = path.join(process.cwd(), "public", cleanUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete voice prompt:", error);
    return { success: false, error: error.message || "Failed to delete local audio file." };
  }
}


