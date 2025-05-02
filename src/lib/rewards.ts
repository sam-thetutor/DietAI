import { MILESTONES, Milestone } from '@/src/config/milestones';
import { UserData, getTodayDateString, getYesterdayDateString, getUserData } from './userData'; // Import getUserData if needed elsewhere, ensure date functions are here
import { HealthProfile, AllCalories } from './types'; // Import necessary types
import { POINTS_CONFIG } from '@/src/config/points'; // <-- Import points config

// --- Helper Functions (Ensure these are defined correctly) ---

// Helper function to check if a day has any calorie entries (numeric value > 0 or non-empty items array)
const hasEntriesForDay = (allCalories: AllCalories, dateKey: string): boolean => {
    const dayData = allCalories[dateKey];
    if (!dayData) return false;
    const hasNumericEntry = (dayData.breakfast && Number(dayData.breakfast) > 0) ||
                           (dayData.lunch && Number(dayData.lunch) > 0) ||
                           (dayData.supper && Number(dayData.supper) > 0);
    const hasItemEntry = (dayData.breakfastItems && dayData.breakfastItems.length > 0) ||
                         (dayData.lunchItems && dayData.lunchItems.length > 0) ||
                         (dayData.supperItems && dayData.supperItems.length > 0);
    return hasNumericEntry || hasItemEntry;
};

// Helper function to count total meals logged (days with any entry)
// Note: This definition might need refinement depending on what "total meals" means.
// This counts *days* with logs. If you want individual breakfast/lunch/supper entries, adjust logic.
const countTotalLoggedDays = (allCalories: AllCalories): number => {
    return Object.keys(allCalories).filter(dateKey => hasEntriesForDay(allCalories, dateKey)).length;
};

// Helper function to count total AI scans (entries with source: 'ai')
const countTotalAiScans = (allCalories: AllCalories): number => {
    let count = 0;
    Object.values(allCalories).forEach(dayData => {
        count += dayData.breakfastItems?.filter(item => item.source === 'ai').length || 0;
        count += dayData.lunchItems?.filter(item => item.source === 'ai').length || 0;
        count += dayData.supperItems?.filter(item => item.source === 'ai').length || 0;
    });
    return count;
};
// --- End Helper Functions ---


/**
 * Checks user data against milestones and updates streak/points.
 * @param currentUserData The user's data *before* the latest log.
 * @param nextAllCalories The complete calorie history *after* the latest log.
 * @param profile The user's health profile (optional, for context).
 * @returns The updated UserData object with potentially new points, streak, and milestones.
 */
export function checkAndAwardMilestones(
    currentUserData: UserData,
    nextAllCalories: AllCalories,
    profile?: HealthProfile | null // Optional profile for context
): UserData { // <-- Return only UserData
    console.log("Checking milestones and points. Current UserData:", currentUserData);
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();

    // Use structuredClone for a deep copy to avoid unintended mutations
    let finalUserData: UserData = structuredClone(currentUserData);
    // Ensure points is initialized as a number
    finalUserData.points = finalUserData.points ?? 0;
    finalUserData.achievedMilestones = finalUserData.achievedMilestones ?? []; // Ensure array exists

    // --- Calculate Potential New State ---
    const todayHasEntries = hasEntriesForDay(nextAllCalories, today);
    const lastTrackedWasYesterday = currentUserData.lastTrackedDate === yesterday;
    const lastTrackedWasToday = currentUserData.lastTrackedDate === today;

    let updatedStreak = currentUserData.currentStreak;
    let updatedLastTrackedDate = currentUserData.lastTrackedDate;

    if (todayHasEntries) {
        if (!lastTrackedWasToday) { // Only update streak/date if not already tracked today
            if (lastTrackedWasYesterday) {
                updatedStreak++;
                console.log("Streak continued. New streak:", updatedStreak);
            } else {
                updatedStreak = 1;
                console.log("New streak started.");
            }
            updatedLastTrackedDate = today;
        } else {
             console.log("Already tracked today, streak/date unchanged.");
        }
    } else {
        console.log("No entries logged for today yet.");
    }

    // --- Calculate Points ---
    let pointsEarnedThisCheck = 0;

    // 1. Points for logging action (only if today has entries and wasn't already tracked)
    //    Or maybe always give points if this function is called after a save? Let's assume always for now.
    pointsEarnedThisCheck += POINTS_CONFIG.PER_LOG_SAVE;
    console.log(`Points Earned: +${POINTS_CONFIG.PER_LOG_SAVE} (for logging action)`);

    // 2. Points for streak increase
    if (updatedStreak > currentUserData.currentStreak) {
        pointsEarnedThisCheck += POINTS_CONFIG.PER_STREAK_DAY;
        console.log(`Points Earned: +${POINTS_CONFIG.PER_STREAK_DAY} (streak increased)`);
    }

    // --- Update UserData fields ---
    finalUserData.currentStreak = updatedStreak;
    finalUserData.lastTrackedDate = updatedLastTrackedDate;
    // Recalculate totals based on the *next* state of allCalories
    finalUserData.totalMealsLogged = countTotalLoggedDays(nextAllCalories); // Use appropriate counting helper
    finalUserData.totalAiScans = countTotalAiScans(nextAllCalories);

    // --- Check Milestones ---
    const newlyAchievedMilestones: string[] = [];
    MILESTONES.forEach((milestone: Milestone) => {
        // Check if already achieved
        if (!finalUserData.achievedMilestones.includes(milestone.id)) {
            let achieved = false;
            // Check conditions based on potentially updated finalUserData and nextAllCalories
            switch (milestone.condition.type) {
                case 'streak':
                    achieved = finalUserData.currentStreak >= milestone.condition.value;
                    break;
                case 'totalMeals': // Assuming this means total logged days now
                    achieved = finalUserData.totalMealsLogged >= milestone.condition.value;
                    break;
                case 'totalScans':
                     achieved = finalUserData.totalAiScans >= milestone.condition.value;
                     break;
                case 'profileComplete':
                     achieved = !!(profile && profile.age && profile.weight && profile.height && profile.gender && profile.activityLevel && profile.goal && profile.calorieTarget);
                     break;
                case 'firstLog': // Check if total logged days is >= 1
                     achieved = finalUserData.totalMealsLogged >= 1;
                     break;
                // Add other condition types here
            }

            if (achieved) {
                newlyAchievedMilestones.push(milestone.id);
                // 3. Points for achieving a milestone
                pointsEarnedThisCheck += POINTS_CONFIG.PER_MILESTONE;
                console.log(`Points Earned: +${POINTS_CONFIG.PER_MILESTONE} (milestone '${milestone.id}' achieved)`);
            }
        }
    });

    // Add newly achieved milestones to the user's list
    if (newlyAchievedMilestones.length > 0) {
        finalUserData.achievedMilestones = [
            ...finalUserData.achievedMilestones,
            ...newlyAchievedMilestones,
        ];
        console.log("Newly achieved milestones:", newlyAchievedMilestones);
    }

    // --- Add Earned Points ---
    finalUserData.points += pointsEarnedThisCheck; // Add points earned in this check
    console.log(`Total points earned this check: ${pointsEarnedThisCheck}. New total points: ${finalUserData.points}`);

    console.log("Final UserData after check:", finalUserData);
    return finalUserData; // <-- Return the single updated object
} 