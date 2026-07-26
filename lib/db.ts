import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/app/generated/prisma";
import fs from "fs";
import path from "path";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let dbInstance: PrismaClient;

if (typeof window === "undefined") {
  const connectionString = process.env.DATABASE_URL?.replace("mysql://", "mariadb://");
  if (!connectionString) {
    console.warn("Warning: DATABASE_URL environment variable is missing. Database operations might fail.");
  }
  // Use a fallback dummy URL if connectionString is missing to prevent Prisma initialization failure on Vercel build
  const dbUrl = connectionString || "mariadb://dummy:dummy@localhost:3306/dummy";
  const adapter = new PrismaMariaDb(dbUrl);
  dbInstance = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
} else {
  dbInstance = {} as PrismaClient;
}

// --- Local File User Store Configuration ---
const USERS_PATH = path.join(process.cwd(), "lib", "users-metadata.json");

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface JSONUser {
  id: number;
  name: string;
  email: string;
  role: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function ensureStoreExists() {
  const dir = path.dirname(USERS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(USERS_PATH)) {
    const defaultUsers: JSONUser[] = [
      {
        id: 1,
        name: "Siddhi Dhamnaskar",
        email: "siddhidhamnaskar64@gmail.com",
        role: "superadmin",
        createdBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(USERS_PATH, JSON.stringify(defaultUsers, null, 2), "utf-8");
  }
}

function readUsers(): User[] {
  ensureStoreExists();
  try {
    const content = fs.readFileSync(USERS_PATH, "utf-8");
    const jsonUsers: JSONUser[] = JSON.parse(content || "[]");
    return jsonUsers.map((u) => ({
      ...u,
      createdAt: new Date(u.createdAt),
      updatedAt: new Date(u.updatedAt),
    }));
  } catch (error) {
    console.error("Failed to read users metadata:", error);
    return [];
  }
}

function writeUsers(users: User[]) {
  ensureStoreExists();
  const jsonUsers: JSONUser[] = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));
  fs.writeFileSync(USERS_PATH, JSON.stringify(jsonUsers, null, 2), "utf-8");
}

class MockUserClient {
  async findUnique(args: { where: { email?: string; id?: number } }) {
    const users = readUsers();
    if (args.where.email !== undefined) {
      const emailLower = args.where.email.toLowerCase();
      return users.find((u) => u.email.toLowerCase() === emailLower) || null;
    }
    if (args.where.id !== undefined) {
      return users.find((u) => u.id === args.where.id) || null;
    }
    return null;
  }

  async findMany(args?: { orderBy?: { createdAt?: "asc" | "desc" } }) {
    const users = readUsers();
    if (args?.orderBy?.createdAt === "desc") {
      return [...users].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    if (args?.orderBy?.createdAt === "asc") {
      return [...users].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    return users;
  }

  async create(args: { data: { name: string; email: string; role: string; createdBy?: string | null } }) {
    const users = readUsers();
    const maxId = users.reduce((max, u) => (u.id > max ? u.id : max), 0);
    const newUser: User = {
      id: maxId + 1,
      name: args.data.name,
      email: args.data.email,
      role: args.data.role,
      createdBy: args.data.createdBy || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(newUser);
    writeUsers(users);
    return newUser;
  }

  async update(args: { where: { id: number }; data: { name?: string; email?: string; role?: string } }) {
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === args.where.id);
    if (idx === -1) {
      throw new Error(`User with id ${args.where.id} not found`);
    }
    const user = users[idx];
    const updatedUser: User = {
      ...user,
      name: args.data.name !== undefined ? args.data.name : user.name,
      email: args.data.email !== undefined ? args.data.email : user.email,
      role: args.data.role !== undefined ? args.data.role : user.role,
      updatedAt: new Date(),
    };
    users[idx] = updatedUser;
    writeUsers(users);
    return updatedUser;
  }

  async delete(args: { where: { id: number } }) {
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === args.where.id);
    if (idx === -1) {
      throw new Error(`User with id ${args.where.id} not found`);
    }
    const deletedUser = users[idx];
    const newUsers = users.filter((u) => u.id !== args.where.id);
    writeUsers(newUsers);
    return deletedUser;
  }

  async upsert(args: {
    where: { email: string };
    update: { role?: string; name?: string };
    create: { email: string; name: string; role: string; createdBy?: string | null };
  }) {
    const users = readUsers();
    const idx = users.findIndex((u) => u.email.toLowerCase() === args.where.email.toLowerCase());
    if (idx !== -1) {
      const user = users[idx];
      const updatedUser: User = {
        ...user,
        name: args.update.name !== undefined ? args.update.name : user.name,
        role: args.update.role !== undefined ? args.update.role : user.role,
        updatedAt: new Date(),
      };
      users[idx] = updatedUser;
      writeUsers(users);
      return updatedUser;
    } else {
      const maxId = users.reduce((max, u) => (u.id > max ? u.id : max), 0);
      const newUser: User = {
        id: maxId + 1,
        name: args.create.name,
        email: args.create.email,
        role: args.create.role,
        createdBy: args.create.createdBy || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.push(newUser);
      writeUsers(users);
      return newUser;
    }
  }
}

// Proxy/wrap dbInstance but override `user` with our local mock
const prismaDb = globalForPrisma.prisma || dbInstance;

export const db = new Proxy(prismaDb, {
  get(target, prop) {
    if (prop === "user" && process.env.NODE_ENV !== "production") {
      return new MockUserClient();
    }
    return Reflect.get(target, prop);
  },
}) as unknown as typeof prismaDb;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaDb;
