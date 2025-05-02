import { HealthProfile, AllCalories } from './types'; // Assuming types are defined/exported here or adjust path

// Define the structure for user-specific reward data
export interface UserData {
    address: string;
    points: number;
    achievedMilestones: string[]; // Array of achieved milestone IDs
    currentStreak: number;        // Consecutive days tracked
    lastTrackedDate: string | null; // YYYY-MM-DD format
    totalMealsLogged: number;
    totalAiScans: number;
    // Add any other user-specific data needed for rewards
}

// Define a prefix for the user data key
const USER_DATA_STORAGE_KEY_PREFIX = "caloai-userdata-";

// Function to get user data from localStorage
export function getUserData(address: string | null | undefined): UserData | null {
    if (!address) return null;

    try {
        // Use the address-specific key
        const key = USER_DATA_STORAGE_KEY_PREFIX + address;
        const storedData = localStorage.getItem(key);
        if (storedData) {
            const parsedData: UserData = JSON.parse(storedData);
            // Basic validation
            if (parsedData && parsedData.address === address) {
                // Ensure all fields exist, providing defaults if necessary
                return {
                    address: parsedData.address,
                    points: parsedData.points ?? 0,
                    achievedMilestones: parsedData.achievedMilestones ?? [],
                    currentStreak: parsedData.currentStreak ?? 0,
                    lastTrackedDate: parsedData.lastTrackedDate ?? null,
                    totalMealsLogged: parsedData.totalMealsLogged ?? 0,
                    totalAiScans: parsedData.totalAiScans ?? 0,
                };
            }
        }
    } catch (error) {
        console.error("Failed to load user data for address:", address, error);
    }

    // Return default structure if not found or error
    return {
        address: address,
        points: 0,
        achievedMilestones: [],
        currentStreak: 0,
        lastTrackedDate: null,
        totalMealsLogged: 0,
        totalAiScans: 0,
    };
}

// Function to save user data to localStorage
export function saveUserData(address: string | null | undefined, data: UserData): boolean {
    // Reinstate address check - important!
    if (!address || data.address !== address) {
        console.error("Cannot save user data: Address mismatch or missing.");
        return false;
    }

    try {
        // Use the address-specific key
        const key = USER_DATA_STORAGE_KEY_PREFIX + address;
        localStorage.setItem(key, JSON.stringify(data));
        console.log("User data saved for address:", address, "to key:", key); // Log the key used
        return true;
    } catch (error) {
        console.error("Failed to save user data for address:", address, error);
        return false;
    }
}

// Helper to get today's date string
export function getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
}

// Helper to get yesterday's date string
export function getYesterdayDateString(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
} 