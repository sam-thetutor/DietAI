import { HealthProfile, AllCalories } from '@/src/lib/types';
import { UserData } from '@/src/lib/userData';

// Context provided to milestone condition checks
export interface MilestoneConditionContext {
    profile: HealthProfile | null;
    allCalories: AllCalories; // Current state of all logged calories
    userData: UserData;        // Current user reward data
    // Add other relevant context if needed, e.g., specific meal data
}

// Structure for a single milestone
export interface Milestone {
    id: string; // Unique identifier
    name: string;
    description: string;
    points: number;
    // Function to check if the milestone condition is met
    condition: (context: MilestoneConditionContext) => boolean;
}

// --- Define Milestones ---
export const MILESTONES: Milestone[] = [
    {
        id: 'PROFILE_COMPLETE',
        name: 'Profile Pro',
        description: 'Complete your health profile.',
        points: 50,
        // Condition: Check if essential profile fields are filled
        condition: ({ profile }) =>
            !!profile &&
            !!profile.age &&
            !!profile.gender && // Assuming gender is required
            !!profile.height &&
            !!profile.weight &&
            !!profile.goal &&
            !!profile.activityLevel &&
            !!profile.calorieTarget,
    },
    {
        id: 'FIRST_MEAL_LOGGED',
        name: 'First Bite',
        description: 'Log your very first meal.',
        points: 20,
        condition: ({ userData }) => userData.totalMealsLogged >= 1,
    },
    {
        id: 'LOGGED_10_MEALS',
        name: 'Meal Tracker',
        description: 'Log a total of 10 meals.',
        points: 50,
        condition: ({ userData }) => userData.totalMealsLogged >= 10,
    },
    {
        id: 'LOGGED_50_MEALS',
        name: 'Dedicated Diner',
        description: 'Log a total of 50 meals.',
        points: 150,
        condition: ({ userData }) => userData.totalMealsLogged >= 50,
    },
     {
        id: 'FIRST_AI_SCAN',
        name: 'AI Assistant User',
        description: 'Use the AI scan feature for the first time.',
        points: 30,
        condition: ({ userData }) => userData.totalAiScans >= 1,
    },
    {
        id: 'STREAK_7_DAYS',
        name: 'Week Warrior',
        description: 'Track meals for 7 days in a row.',
        points: 100,
        condition: ({ userData }) => userData.currentStreak >= 7,
    },
    {
        id: 'STREAK_30_DAYS',
        name: 'Month Master',
        description: 'Track meals for 30 days in a row.',
        points: 500,
        condition: ({ userData }) => userData.currentStreak >= 30,
    },
    // Add more milestones as needed
]; 