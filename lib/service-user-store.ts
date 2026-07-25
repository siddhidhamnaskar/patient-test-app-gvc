import fs from "fs";
import path from "path";

const SERVICE_USERS_PATH = path.join(process.cwd(), "lib", "service-users.json");

export interface ServiceUser {
  id: string;
  name: string;
  dob: string;
  nhsNumber?: string;
  clientRef?: string;
  gender?: string;
  notes?: string;
  createdAt: string;
}

function ensureServiceUsersStoreExists() {
  const dir = path.dirname(SERVICE_USERS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(SERVICE_USERS_PATH)) {
    fs.writeFileSync(SERVICE_USERS_PATH, JSON.stringify([], null, 2), "utf-8");
  }
}

export function getServiceUsers(): ServiceUser[] {
  try {
    ensureServiceUsersStoreExists();
    const content = fs.readFileSync(SERVICE_USERS_PATH, "utf-8");
    return JSON.parse(content || "[]");
  } catch (error) {
    console.error("Failed to read service users:", error);
    return [];
  }
}

export function saveServiceUser(item: ServiceUser): boolean {
  try {
    ensureServiceUsersStoreExists();
    const items = getServiceUsers();
    items.unshift(item); // Prepend to show most recently created first
    fs.writeFileSync(SERVICE_USERS_PATH, JSON.stringify(items, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Failed to save service user:", error);
    return false;
  }
}

export function getServiceUserById(id: string): ServiceUser | undefined {
  try {
    const items = getServiceUsers();
    return items.find((item) => item.id === id);
  } catch (error) {
    console.error(`Failed to find service user ${id}:`, error);
    return undefined;
  }
}
