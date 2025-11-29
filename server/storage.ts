import { type User, type InsertUser, type Generation, type InsertGeneration } from "@shared/schema";
import { randomUUID } from "crypto";

// Storage interface for database operations
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserCredits(userId: string, credits: number): Promise<User>;
  createGeneration(generation: InsertGeneration): Promise<Generation>;
  getGeneration(id: string): Promise<Generation | undefined>;
  getUserGenerations(userId: string): Promise<Generation[]>;
  cancelGeneration(id: string): Promise<boolean>;
}

/**
 * In-memory storage implementation
 * TODO: Replace with actual database (PostgreSQL + Drizzle)
 */
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private generations: Map<string, Generation>;

  constructor() {
    this.users = new Map();
    this.generations = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      credits: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserCredits(userId: string, credits: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updated: User = {
      ...user,
      credits,
      updatedAt: new Date(),
    };

    this.users.set(userId, updated);
    return updated;
  }

  async createGeneration(generation: InsertGeneration): Promise<Generation> {
    const id = randomUUID();
    const newGeneration: Generation = {
      ...generation,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Generation;

    this.generations.set(id, newGeneration);
    return newGeneration;
  }

  async getGeneration(id: string): Promise<Generation | undefined> {
    return this.generations.get(id);
  }

  async getUserGenerations(userId: string): Promise<Generation[]> {
    return Array.from(this.generations.values()).filter(
      (gen) => gen.userId === userId,
    );
  }

  async cancelGeneration(id: string): Promise<boolean> {
    return this.generations.delete(id);
  }
}

export const storage = new MemStorage();
