import fs from "fs";
import path from "path";

const METADATA_PATH = path.join(process.cwd(), "lib", "images-metadata.json");

export interface ImageMetadata {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  createdAt: string;
}

// Ensure the directory and file exist
function ensureStoreExists() {
  const dir = path.dirname(METADATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(METADATA_PATH)) {
    fs.writeFileSync(METADATA_PATH, JSON.stringify([], null, 2), "utf-8");
  }
}

// Fetch all uploaded images
export function getImagesMetadata(): ImageMetadata[] {
  try {
    ensureStoreExists();
    const content = fs.readFileSync(METADATA_PATH, "utf-8");
    return JSON.parse(content || "[]");
  } catch (error) {
    console.error("Failed to read images metadata:", error);
    return [];
  }
}

// Save a new image item
export function saveImageMetadata(item: ImageMetadata): boolean {
  try {
    ensureStoreExists();
    const items = getImagesMetadata();
    items.unshift(item); // Add to the beginning of list
    fs.writeFileSync(METADATA_PATH, JSON.stringify(items, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Failed to save image metadata:", error);
    return false;
  }
}

// Update the name label of a specific image
export function updateImageName(id: string, newName: string): boolean {
  try {
    ensureStoreExists();
    const items = getImagesMetadata();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }
    items[index].name = newName.trim();
    fs.writeFileSync(METADATA_PATH, JSON.stringify(items, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Failed to update image metadata name:", error);
    return false;
  }
}
