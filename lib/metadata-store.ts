import fs from "fs";
import path from "path";
import os from "os";

const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

const METADATA_PATH = isProduction
  ? path.join(os.tmpdir(), "images-metadata.json")
  : path.join(process.cwd(), "lib", "images-metadata.json");
const QUESTIONS_PATH = isProduction
  ? path.join(os.tmpdir(), "questions-metadata.json")
  : path.join(process.cwd(), "lib", "questions-metadata.json");
const LEVELS_PATH = isProduction
  ? path.join(os.tmpdir(), "levels-metadata.json")
  : path.join(process.cwd(), "lib", "levels-metadata.json");

export interface ScreenMetadata {
  id: string;
  name: string;
  imageId?: string;
  imageIds?: string[];
  questionId?: string;
  questionIds?: string[];
  voiceRecordEnabled?: boolean[];
  voicePromptUrls?: string[];
  answers?: string[];
  order: number;
}

export interface LevelMetadata {
  id: string;
  name: string;
  order: number;
  screens?: ScreenMetadata[];
}

export interface ImageMetadata {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  createdAt: string;
}

export interface QuestionMetadata {
  id: string;
  text: string;
}

// Ensure the directory and image file exist
function ensureStoreExists() {
  const dir = path.dirname(METADATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(METADATA_PATH)) {
    const bundledPath = path.join(process.cwd(), "lib", "images-metadata.json");
    if (fs.existsSync(bundledPath)) {
      try {
        const content = fs.readFileSync(bundledPath, "utf-8");
        fs.writeFileSync(METADATA_PATH, content, "utf-8");
        return;
      } catch (err) {
        console.error("Failed to copy bundled images to /tmp:", err);
      }
    }
    fs.writeFileSync(METADATA_PATH, JSON.stringify([], null, 2), "utf-8");
  }
}

// Ensure the directory and questions file exist
function ensureQuestionsStoreExists() {
  const dir = path.dirname(QUESTIONS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(QUESTIONS_PATH)) {
    const bundledPath = path.join(process.cwd(), "lib", "questions-metadata.json");
    if (fs.existsSync(bundledPath)) {
      try {
        const content = fs.readFileSync(bundledPath, "utf-8");
        fs.writeFileSync(QUESTIONS_PATH, content, "utf-8");
        return;
      } catch (err) {
        console.error("Failed to copy bundled questions to /tmp:", err);
      }
    }
    fs.writeFileSync(QUESTIONS_PATH, JSON.stringify([], null, 2), "utf-8");
  }
}

// Fetch all uploaded images
export function getImagesMetadata(): ImageMetadata[] {
  try {
    ensureStoreExists();
    const content = fs.readFileSync(METADATA_PATH, "utf-8");
    let items: ImageMetadata[] = JSON.parse(content || "[]");
    
    console.log(`[Metadata Store] getImagesMetadata: file=${METADATA_PATH}, count=${items.length}, isProduction=${isProduction}`);

    let changed = false;
    items = items.map(item => {
      if (item.url && !item.url.startsWith("/app3001") && item.url.includes("uploads/")) {
        const oldUrl = item.url;
        const index = item.url.indexOf("uploads/");
        item.url = "/app3001/" + item.url.substring(index);
        console.log(`[Metadata Store] Migrating image path: ${oldUrl} -> ${item.url}`);
        changed = true;
      }
      return item;
    });

    if (changed) {
      try {
        fs.writeFileSync(METADATA_PATH, JSON.stringify(items, null, 2), "utf-8");
        console.log(`[Metadata Store] Successfully wrote migrated images metadata to ${METADATA_PATH}`);
      } catch (err) {
        console.error("[Metadata Store] Failed to auto-migrate image URLs in store file:", err);
      }
    }

    return items;
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

// Fetch all questions
export function getQuestionsMetadata(): QuestionMetadata[] {
  try {
    ensureQuestionsStoreExists();
    const content = fs.readFileSync(QUESTIONS_PATH, "utf-8");
    return JSON.parse(content || "[]");
  } catch (error) {
    console.error("Failed to read questions metadata:", error);
    return [];
  }
}

// Save a single question item (checks duplicate)
export function saveQuestionMetadata(item: QuestionMetadata): boolean {
  return saveQuestionsMetadata([item]);
}

// Save multiple questions (updating duplicate IDs)
export function saveQuestionsMetadata(newItems: QuestionMetadata[]): boolean {
  try {
    ensureQuestionsStoreExists();
    const existing = getQuestionsMetadata();
    const mergedList: QuestionMetadata[] = [...existing];

    for (const newItem of newItems) {
      const idx = mergedList.findIndex(x => x.id.toLowerCase() === newItem.id.toLowerCase());
      if (idx !== -1) {
        mergedList[idx] = newItem; // Update text
      } else {
        mergedList.unshift(newItem); // Prepend new
      }
    }

    fs.writeFileSync(QUESTIONS_PATH, JSON.stringify(mergedList, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Failed to save questions metadata:", error);
    return false;
  }
}

// Ensure levels file exists
function ensureLevelsStoreExists() {
  const dir = path.dirname(LEVELS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LEVELS_PATH)) {
    const bundledPath = path.join(process.cwd(), "lib", "levels-metadata.json");
    if (fs.existsSync(bundledPath)) {
      try {
        const content = fs.readFileSync(bundledPath, "utf-8");
        fs.writeFileSync(LEVELS_PATH, content, "utf-8");
        return;
      } catch (err) {
        console.error("Failed to copy bundled levels to /tmp:", err);
      }
    }
    const defaultLevels: LevelMetadata[] = [
      { id: "lvl_1", name: "Level 1", order: 1 },
      { id: "lvl_2", name: "Level 2", order: 2 },
      { id: "lvl_3", name: "Level 3", order: 3 },
    ];
    fs.writeFileSync(LEVELS_PATH, JSON.stringify(defaultLevels, null, 2), "utf-8");
  }
}

// Fetch all test levels, sorted by order
export function getLevelsMetadata(): LevelMetadata[] {
  try {
    ensureLevelsStoreExists();
    const content = fs.readFileSync(LEVELS_PATH, "utf-8");
    let levels: LevelMetadata[] = JSON.parse(content || "[]");

    console.log(`[Metadata Store] getLevelsMetadata: file=${LEVELS_PATH}, isProduction=${isProduction}`);

    let changed = false;
    levels = levels.map(level => {
      if (level.screens) {
        level.screens = level.screens.map(screen => {
          if (screen.voicePromptUrls) {
            screen.voicePromptUrls = screen.voicePromptUrls.map(url => {
              if (url && !url.startsWith("/app3001") && url.includes("recordings/")) {
                const oldUrl = url;
                const index = url.indexOf("recordings/");
                const newUrl = "/app3001/" + url.substring(index);
                console.log(`[Metadata Store] Migrating recording path: ${oldUrl} -> ${newUrl}`);
                changed = true;
                return newUrl;
              }
              return url;
            });
          }
          return screen;
        });
      }
      return level;
    });

    if (changed) {
      try {
        fs.writeFileSync(LEVELS_PATH, JSON.stringify(levels, null, 2), "utf-8");
        console.log(`[Metadata Store] Successfully wrote migrated levels metadata to ${LEVELS_PATH}`);
      } catch (err) {
        console.error("[Metadata Store] Failed to auto-migrate recording URLs in levels file:", err);
      }
    }

    return levels.sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error("Failed to read levels metadata:", error);
    return [];
  }
}

// Save all test levels
export function saveLevelsMetadata(levels: LevelMetadata[]): boolean {
  try {
    ensureLevelsStoreExists();
    fs.writeFileSync(LEVELS_PATH, JSON.stringify(levels, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Failed to save levels metadata:", error);
    return false;
  }
}
