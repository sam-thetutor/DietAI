// Profile Types
export type HealthGoal = "weight_loss" | "weight_gain" | "maintenance";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export interface HealthProfile {
  age: number | "";
  gender: string;
  height: number | "";
  weight: number | "";
  goal: HealthGoal;
  activityLevel: ActivityLevel;
  restrictions: string;
  calorieTarget: number | "";
}

// Represents a single logged food item or meal component
export interface CalorieLogEntry {
  id: string; // Unique identifier (e.g., timestamp string or UUID)
  timestamp: string; // ISO string timestamp of when it was logged
  source: 'manual' | 'ai'; // How the entry was created
  items: string[]; // Array of food item names (e.g., ["apple", "peanut butter"])
  estimatedCalories: number | null; // Estimated calories for this specific entry
  // Add other relevant fields if needed, e.g., quantity, notes
}

// Represents all calorie data for a single day
export interface MealCalories {
  breakfast: CalorieLogEntry[];
  lunch: CalorieLogEntry[];
  supper: CalorieLogEntry[];
}

export interface AllCalories {
  [dateKey: string]: MealCalories; // Key is YYYY-MM-DD string
}

// Add other shared types as needed 