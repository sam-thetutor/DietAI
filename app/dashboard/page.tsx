"use client";

import Link from "next/link";
import { Card, Button } from "../components/DemoComponents"; // Adjust path as needed
import { useState, useEffect, useMemo } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine
} from 'recharts'; // Import Recharts components
import { useAccount } from "wagmi";
import { HealthProfile, AllCalories, MealCalories, CalorieLogEntry } from "@/src/lib/types"; // Assuming types are defined here

// --- Updated Types (Match track/page.tsx) ---
// type HealthGoal = "weight_loss" | "weight_gain" | "maintenance";
// type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

// interface HealthProfile {
//   age: number | "";
//   gender: string;
//   height: number | "";
//   weight: number | "";
//   goal: HealthGoal;
//   activityLevel: ActivityLevel;
//   restrictions: string;
//   calorieTarget: number | "";
// }

// interface MealCalories {
//   breakfast: number | "";
//   lunch: number | "";
//   supper: number | "";
//   // Use CalorieLogEntry array instead of string array
//   breakfastItems?: CalorieLogEntry[];
//   lunchItems?: CalorieLogEntry[];
//   supperItems?: CalorieLogEntry[];
// }

// interface AllCalories {
//   [dateKey: string]: MealCalories;
// }
// --- End Updated Types ---

// New Type for Meal Plan
interface MealPlan {
    breakfast: string[];
    lunch: string[];
    supper: string[];
}

const PROFILE_STORAGE_KEY = "caloai-healthProfile";
const CALORIES_STORAGE_KEY = "caloai-allCalories";
const MEAL_PLAN_STORAGE_KEY = "caloai-mealPlan"; // Key for stored plan

// Helper function to format date as YYYY-MM-DD
const formatDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Helper to calculate total calories for a meal object
const calculateDailyTotal = (meals: MealCalories | undefined): number => {
    if (!meals) return 0;
    const breakfast = typeof meals.breakfast === 'number' ? meals.breakfast : 0;
    const lunch = typeof meals.lunch === 'number' ? meals.lunch : 0;
    const supper = typeof meals.supper === 'number' ? meals.supper : 0;
    return breakfast + lunch + supper;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [allCalories, setAllCalories] = useState<AllCalories>({});
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingCalories, setIsLoadingCalories] = useState(true);
  const { address, isConnected } = useAccount(); // <-- Get address


  // --- State for Recommendations ---
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [errorRecs, setErrorRecs] = useState<string | null>(null);
  // --- End State for Recommendations ---

  // --- State for Meal Plan ---
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isLoadingMealPlan, setIsLoadingMealPlan] = useState(true);
  // --- End State for Meal Plan ---

  // Load Profile Data
  useEffect(() => {
    setIsLoadingProfile(true);
    try {
      const storedProfile = localStorage.getItem(`${PROFILE_STORAGE_KEY}-${address}`);
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        if (parsed && typeof parsed === 'object') { // Basic validation
             setProfile(parsed as HealthProfile);
        } else {
            localStorage.removeItem(PROFILE_STORAGE_KEY); // Clear invalid data
        }
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  // Load Calorie Data
  useEffect(() => {
    setIsLoadingCalories(true);
    if (!address) { // Don't try to load if address isn't available
        setIsLoadingCalories(false);
        return;
    }
    try {
      // Use the correct, unified key with address
      const key = `${CALORIES_STORAGE_KEY}-${address}`;
      console.log("Dashboard: Loading calories from key:", key); // Debug log
      const storedCalories = localStorage.getItem(key);
      if (storedCalories) {
         const parsed = JSON.parse(storedCalories);
         if (parsed && typeof parsed === 'object') { // Basic validation
            console.log("Dashboard: Parsed calories:", parsed); // Debug log
            setAllCalories(parsed as AllCalories);
         } else {
             console.warn("Dashboard: Invalid calorie data found, clearing."); // Debug log
             localStorage.removeItem(key); // Clear invalid data using the correct key
             setAllCalories({}); // Reset state
         }
      } else {
          console.log("Dashboard: No calories found in storage for key:", key); // Debug log
          setAllCalories({}); // Reset state
      }
    } catch (error) {
      console.error("Dashboard: Failed to load calories:", error);
      setAllCalories({}); // Reset state on error
    } finally {
      setIsLoadingCalories(false);
    }
    // Add address to dependency array to reload if user connects/disconnects
  }, [address]);

  // --- Load Meal Plan Data ---
  useEffect(() => {
    setIsLoadingMealPlan(true);
    try {
      const storedPlan = localStorage.getItem(`${MEAL_PLAN_STORAGE_KEY}-${address}`);
      if (storedPlan) {
        const parsed = JSON.parse(storedPlan);
        // Basic validation for the plan structure
        if (parsed && Array.isArray(parsed.breakfast) && Array.isArray(parsed.lunch) && Array.isArray(parsed.supper)) {
             setMealPlan(parsed as MealPlan);
        } else {
            console.warn("Invalid meal plan data found in local storage.");
            localStorage.removeItem(MEAL_PLAN_STORAGE_KEY); // Clear invalid data
        }
      }
    } catch (error) {
      console.error("Failed to load meal plan:", error);
    } finally {
      setIsLoadingMealPlan(false);
    }
  }, []);

  // --- Calculate Analytics ---
  const analytics = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    const todayData = allCalories[todayKey];
    const todayTotal = calculateDailyTotal(todayData);

    const weeklyData = [];
    const allLoggedFoods: string[] = []; // Array to hold all food item strings
    const foodCounts: { [key: string]: number } = {}; // Count occurrences of each food

    // Calculate data for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = formatDateKey(date);
      const dailyTotal = calculateDailyTotal(allCalories[dateKey]);
      weeklyData.push({
        name: date.toLocaleDateString('en-US', { weekday: 'short' }), // e.g., 'Mon'
        calories: dailyTotal,
        date: dateKey,
      });

      // --- START: Updated Food Item Processing ---
      const dailyMealData = allCalories[dateKey];
      if (dailyMealData) {
        // Helper to process items from a CalorieLogEntry array
        const processItems = (logEntries: CalorieLogEntry[] | undefined) => {
          if (!logEntries) return;

          logEntries.forEach(entry => { // 'entry' is a CalorieLogEntry object
            // Check if the entry object has an 'items' array
            if (Array.isArray(entry.items)) {
              entry.items.forEach(itemString => { // 'itemString' is the actual food name string
                if (typeof itemString === 'string') { // Ensure it's a string
                  const lowerItem = itemString.toLowerCase();
                  allLoggedFoods.push(lowerItem); // Add the string to the list
                  foodCounts[lowerItem] = (foodCounts[lowerItem] || 0) + 1; // Count it
                } else {
                   console.warn("Dashboard analytics: Found non-string item within entry.items:", itemString, "in entry:", entry);
                }
              });
            }
             // Optional: Warn if an entry doesn't have the expected items array
             // else {
             //    console.warn("Dashboard analytics: CalorieLogEntry missing 'items' array:", entry);
             // }
          });
        };

        // Process items for each meal type for the day
        processItems(dailyMealData.breakfastItems);
        processItems(dailyMealData.lunchItems);
        processItems(dailyMealData.supperItems);
      }
      // --- END: Updated Food Item Processing ---
    }

    // Find most common foods (example: top 5)
    const commonFoods = Object.entries(foodCounts)
      .sort(([, countA], [, countB]) => countB - countA) // Sort by count descending
      .slice(0, 5) // Take top 5
      .map(([food]) => food); // Get just the food names

    const calorieTarget = profile?.calorieTarget ? Number(profile.calorieTarget) : 0;
    const hasTarget = !!calorieTarget && calorieTarget > 0;

    // --- START: Calculate remaining and progress ---
    let caloriesRemaining: number | null = null;
    let progressPercent = 0;

    if (hasTarget) {
      caloriesRemaining = calorieTarget - todayTotal;
      // Ensure progress doesn't exceed 100 unless you want it to show overflow
      progressPercent = Math.min(100, (todayTotal / calorieTarget) * 100);
      if (isNaN(progressPercent) || !isFinite(progressPercent)) {
          progressPercent = 0; // Handle division by zero or invalid numbers
      }
    }
    // --- END: Calculate remaining and progress ---

    return {
      todayTotal,
      todayData,
      chartData: weeklyData,
      calorieTarget: calorieTarget,
      hasTarget: hasTarget,
      allLoggedFoods: [...new Set(allLoggedFoods)],
      commonFoods: commonFoods,
      caloriesRemaining: caloriesRemaining,
      progressPercent: progressPercent,
    };
  }, [allCalories, profile]);

  // --- Fetch General Recommendations useEffect ---
  useEffect(() => {
    setErrorRecs(null); // Clear previous errors

    // Fetch recommendations if profile goal exists and common foods are calculated
    const shouldFetch = profile?.goal && analytics.commonFoods.length > 0;

    if (shouldFetch) {
      setIsLoadingRecs(true);
      fetch('/api/recommend-food', { // Use the same endpoint, its behavior changed
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Send only goal and common foods
          healthGoal: profile.goal,
          commonFoods: analytics.commonFoods,
        }),
      })
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Failed to parse error response' }));
          throw new Error(errorData.error || `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((data: { recommendations: string[] }) => {
        setRecommendations(data.recommendations || []);
      })
      .catch((error: unknown) => {
        console.error("Failed to fetch recommendations:", error);
        const message = error instanceof Error ? error.message : "Could not load suggestions.";
        setErrorRecs(message);
        setRecommendations([]); // Clear recommendations on error
      })
      .finally(() => {
        setIsLoadingRecs(false);
      });
    } else {
      // If conditions aren't met, ensure recommendations are cleared and not loading
      setRecommendations([]);
      setIsLoadingRecs(false);
    }
    // Dependencies: Fetch when profile goal or common foods change
  }, [profile?.goal, analytics.commonFoods]);

  const isLoading = isLoadingProfile || isLoadingCalories || isLoadingMealPlan;

  // --- Render ---
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-4xl mx-auto px-4 py-3">
        <header className="flex justify-between items-center mb-6 h-11">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <Link href="/">
            <Button variant="outline" size="sm">
              Back Home
            </Button>
          </Link>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* --- Today's Summary Card --- */}
          <Card title="Today's Summary" className="lg:col-span-1">
            {!profile || !analytics.hasTarget ? (
                 <p className="text-center text-[var(--app-foreground-muted)]">
                    Set your <Link href="/profile" className="text-[var(--app-accent)] underline">daily calorie target</Link>.
                 </p>
            ) : (
                <div className="space-y-4">
                    {/* Total and Remaining */}
                    <div className="flex justify-around items-center text-center">
                        <div>
                            <p className="text-2xl font-bold text-[var(--app-foreground)]">{analytics.todayTotal}</p>
                            <p className="text-xs text-[var(--app-foreground-muted)]">Calories Eaten</p>
                        </div>
                        <div className="h-10 border-l border-[var(--app-card-border)]"></div> {/* Divider */}
                        <div>
                            <p className={`text-2xl font-bold ${analytics.caloriesRemaining !== null && analytics.caloriesRemaining < 0 ? 'text-red-500' : 'text-[var(--app-accent)]'}`}>
                                {analytics.caloriesRemaining !== null ? Math.abs(analytics.caloriesRemaining) : '-'}
                            </p>
                            <p className="text-xs text-[var(--app-foreground-muted)]">
                                {analytics.caloriesRemaining !== null ? (analytics.caloriesRemaining >= 0 ? 'Remaining' : 'Over Target') : 'Target Not Set'}
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                        <div className="flex justify-between text-xs text-[var(--app-foreground-muted)] mb-1">
                            <span>Goal: {analytics.calorieTarget} kcal</span>
                            <span>{analytics.progressPercent.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-[var(--app-gray)] rounded-full h-2.5 border border-[var(--app-card-border)]">
                            <div
                                className="bg-[var(--app-accent)] h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${analytics.progressPercent}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            )}
          </Card>

          {/* --- Today's Meals Card --- */}
          <Card title="Today's Meals" className="lg:col-span-1">
            {analytics.todayTotal > 0 ? (
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                        <p className="text-lg font-semibold text-[var(--app-foreground)]">{analytics.todayData.breakfast || 0}</p>
                        <p className="text-xs text-[var(--app-foreground-muted)]">🍳 Breakfast</p>
                    </div>
                    <div>
                        <p className="text-lg font-semibold text-[var(--app-foreground)]">{analytics.todayData.lunch || 0}</p>
                        <p className="text-xs text-[var(--app-foreground-muted)]">🥪 Lunch</p>
                    </div>
                    <div>
                        <p className="text-lg font-semibold text-[var(--app-foreground)]">{analytics.todayData.supper || 0}</p>
                        <p className="text-xs text-[var(--app-foreground-muted)]">🍲 Supper</p>
                    </div>
                </div>
            ) : (
                 <p className="text-center text-[var(--app-foreground-muted)]">
                    No calories logged for today yet. Go to the <Link href="/track" className="text-[var(--app-accent)] underline">Track</Link> page!
                 </p>
            )}
          </Card>

          {/* --- Common Foods Card (Moved back here) --- */}
          <Card title="Common Foods" className="lg:col-span-1"> {/* Restored span */}
            {analytics.commonFoods.length > 0 ? (
                <ul className="space-y-1 list-disc list-inside text-sm text-[var(--app-foreground)]">
                    {analytics.commonFoods.map((item, index) => (
                        <li key={index} className="capitalize">{item}</li>
                    ))}
                </ul>
            ) : (
                <p className="text-center text-sm text-[var(--app-foreground-muted)]">
                    Upload images of your meals on the <Link href="/track" className="text-[var(--app-accent)] underline">Track</Link> page for AI to identify common foods.
                </p>
            )}
          </Card>

          {/* --- Weekly Trends Card (Restored spans) --- */}
          <Card title="Weekly Trends" className="md:col-span-2 lg:col-span-3"> {/* Restored spans */}
             <div className="space-y-4">
                 <p className="text-sm text-[var(--app-foreground-muted)]">
                    Average daily intake (last 7 logged days): <span className="font-semibold text-[var(--app-foreground)]">{analytics.chartData.some(d => d.calories > 0) ? analytics.chartData.reduce((a, b) => a + b.calories, 0) / analytics.chartData.length : 0} kcal</span>
                 </p>
                 {analytics.chartData.some(d => d.calories > 0) ? (
                    <div className="h-60 w-full">
                        <ResponsiveContainer>
                            <BarChart data={analytics.chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--app-card-border)" />
                                <XAxis dataKey="name" fontSize={10} stroke="var(--app-foreground-muted)" />
                                <YAxis fontSize={10} stroke="var(--app-foreground-muted)" />
                                <Tooltip cursor={{ fill: 'var(--app-gray)' }} contentStyle={{ backgroundColor: 'var(--app-background)', borderColor: 'var(--app-card-border)', borderRadius: '0.5rem', color: 'var(--app-foreground)' }} />
                                <Bar dataKey="calories" fill="var(--app-accent)" radius={[4, 4, 0, 0]} />
                                {analytics.hasTarget && analytics.calorieTarget > 0 && (
                                    <ReferenceLine y={analytics.calorieTarget} label={{ value: "Target", position: "insideTopRight", fill: "var(--app-accent-error)", fontSize: 10, dy: -5 }} stroke="var(--app-accent-error)" strokeDasharray="3 3" strokeWidth={1.5} />
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                 ) : (
                    <p className="text-center text-sm text-[var(--app-foreground-muted)]">Log more days to see your weekly trend chart.</p>
                 )}
             </div>
          </Card>

          {/* --- Food Suggestions Card (Updated Purpose) --- */}
          <Card title="💡 Dietary Suggestions" className="md:col-span-2 lg:col-span-3">
            {isLoadingRecs && (
                <div className="flex justify-center items-center py-4">
                    {/* Spinner */}
                    <svg className="animate-spin h-5 w-5 text-[var(--app-foreground-muted)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-2 text-sm text-[var(--app-foreground-muted)]">Generating suggestions...</span>
                </div>
            )}
            {errorRecs && <p className="text-center text-sm text-red-500 px-2 py-4">{errorRecs}</p>}
            {!isLoadingRecs && !errorRecs && recommendations.length > 0 && (
              <ul className="space-y-2 list-none text-sm text-[var(--app-foreground)] p-1">
                {recommendations.map((rec, index) => (
                  <li key={index} className="border-b border-[var(--app-card-border)] pb-1 mb-1 last:border-b-0 last:pb-0 last:mb-0">
                    {rec}
                  </li>
                ))}
              </ul>
            )}
            {/* Updated Placeholder messages */}
            {!isLoadingRecs && !errorRecs && recommendations.length === 0 && (
                <>
                    {profile?.goal && analytics.commonFoods.length > 0 && (
                        <p className="text-center text-sm text-[var(--app-foreground-muted)] px-2 py-4">No specific suggestions generated currently. Try logging more varied meals!</p>
                    )}
                    {(!profile?.goal || analytics.commonFoods.length === 0) && (
                        <p className="text-center text-sm text-[var(--app-foreground-muted)] px-2 py-4">
                            Set a health goal in your <Link href="/profile" className="text-[var(--app-accent)] underline">Profile</Link> and log some meals via the <Link href="/track" className="text-[var(--app-accent)] underline">Track</Link> page to get personalized dietary suggestions.
                        </p>
                    )}
                </>
            )}
          </Card>

          {/* --- AI Meal Plan Card (New) --- */}
          <Card title="📅 AI Meal Plan Suggestions" className="md:col-span-2 lg:col-span-3">
            {mealPlan ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    {/* Breakfast Column */}
                    <div>
                        <h4 className="font-semibold mb-2 border-b border-[var(--app-card-border)] pb-1">🍳 Breakfast</h4>
                        <ul className="space-y-1 list-disc list-inside">
                            {mealPlan.breakfast.map((meal, index) => <li key={`b-${index}`}>{meal}</li>)}
                        </ul>
                    </div>
                    {/* Lunch Column */}
                     <div>
                        <h4 className="font-semibold mb-2 border-b border-[var(--app-card-border)] pb-1">🥪 Lunch</h4>
                        <ul className="space-y-1 list-disc list-inside">
                            {mealPlan.lunch.map((meal, index) => <li key={`l-${index}`}>{meal}</li>)}
                        </ul>
                    </div>
                     {/* Supper Column */}
                     <div>
                        <h4 className="font-semibold mb-2 border-b border-[var(--app-card-border)] pb-1">🍲 Supper</h4>
                        <ul className="space-y-1 list-disc list-inside">
                            {mealPlan.supper.map((meal, index) => <li key={`s-${index}`}>{meal}</li>)}
                        </ul>
                    </div>
                </div>
            ) : (
                 <p className="text-center text-sm text-[var(--app-foreground-muted)] px-2 py-4">
                    No meal plan generated yet. Uploading images of new foods on the <Link href="/track" className="text-[var(--app-accent)] underline">Track</Link> page will generate one based on your profile and history.
                 </p>
            )}
          </Card>

          {/* --- All Logged Foods Card (New) --- */}
          <Card title="📖 Your Food Log History" className="md:col-span-2 lg:col-span-3">
            {analytics.allLoggedFoods.length > 0 ? (
                // Display as columns for better readability if list is long
                <ul className="columns-2 md:columns-3 lg:columns-4 gap-x-6 space-y-1 list-disc list-inside text-sm text-[var(--app-foreground)] p-1">
                    {analytics.allLoggedFoods.map((item, index) => (
                        <li key={index} className="capitalize break-inside-avoid"> {/* Prevent items breaking across columns */}
                            {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-center text-sm text-[var(--app-foreground-muted)] px-2 py-4">
                    No food items identified yet. Upload meal images on the <Link href="/track" className="text-[var(--app-accent)] underline">Track</Link> page.
                </p>
            )}
          </Card>

        </main>
      </div>
    </div>
  );
} 