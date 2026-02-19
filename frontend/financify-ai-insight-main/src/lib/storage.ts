export interface StoredFile {
  id: string;
  name: string;
  uploadDate: string;
  data: any[];
  bankInfo: any;
  analysis?: any;
}

export const storage = {
  KEYS: {
    FILES: "finance_uploaded_files",
    CURRENT_FILE: "finance_current_file",
    PREFERENCES: "finance_preferences",
    BUDGETS: "finance_budgets",
  },

  // File management
  saveFile(file: StoredFile): void {
    const files = this.getAllFiles();
    files.push(file);
    localStorage.setItem(this.KEYS.FILES, JSON.stringify(files));
  },

  getAllFiles(): StoredFile[] {
    const data = localStorage.getItem(this.KEYS.FILES);
    return data ? JSON.parse(data) : [];
  },

  getFileById(id: string): StoredFile | null {
    const files = this.getAllFiles();
    return files.find((f) => f.id === id) || null;
  },

  deleteFile(id: string): void {
    const files = this.getAllFiles();
    const filtered = files.filter((f) => f.id !== id);
    localStorage.setItem(this.KEYS.FILES, JSON.stringify(filtered));
  },

  // Current file
  setCurrentFile(file: StoredFile | null): void {
    if (file) {
      localStorage.setItem(this.KEYS.CURRENT_FILE, JSON.stringify(file));
    } else {
      localStorage.removeItem(this.KEYS.CURRENT_FILE);
    }
  },

  getCurrentFile(): StoredFile | null {
    const data = localStorage.getItem(this.KEYS.CURRENT_FILE);
    return data ? JSON.parse(data) : null;
  },

  // Budget management
  saveBudgets(budgets: Record<string, number>): void {
    localStorage.setItem(this.KEYS.BUDGETS, JSON.stringify(budgets));
  },

  getBudgets(): Record<string, number> {
    const data = localStorage.getItem(this.KEYS.BUDGETS);
    return data ? JSON.parse(data) : {};
  },

  // Preferences
  savePreferences(prefs: any): void {
    localStorage.setItem(this.KEYS.PREFERENCES, JSON.stringify(prefs));
  },

  getPreferences(): any {
    const data = localStorage.getItem(this.KEYS.PREFERENCES);
    return data ? JSON.parse(data) : { currency: "USD", theme: "light" };
  },

  // Clear all data
  clearAll(): void {
    Object.values(this.KEYS).forEach((key: string) => {
      localStorage.removeItem(key);
    });
  },
};
