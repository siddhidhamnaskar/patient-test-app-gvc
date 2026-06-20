import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/app/generated/prisma";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let dbInstance: PrismaClient;

if (typeof window === "undefined") {
  const connectionString = process.env.DATABASE_URL?.replace("mysql://", "mariadb://");
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }
  const adapter = new PrismaMariaDb(connectionString);
  dbInstance = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
} else {
  dbInstance = {} as PrismaClient;
}

export const db = globalForPrisma.prisma || dbInstance;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
