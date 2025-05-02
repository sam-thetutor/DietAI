"use client";

import Link from "next/link";
import { Card, Button } from "../components/DemoComponents"; // Adjust path as needed
import { useAccount } from "wagmi";
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
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

// --- Updated Types (Match track/page.tsx) ---
type HealthGoal = "weight_loss" | "weight_gain" | "maintenance";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

interface HealthProfile {
  age: number | "";
  gender: string;
  height: number | "";
  weight: number | "";
  goal: HealthGoal;
  activityLevel: ActivityLevel;
  restrictions: string;
  calorieTarget: number | "";
}

interface MealCalories {
  breakfast: number | "";
  lunch: number | "";
  supper: number | "";
  breakfastItems?: string[];
  lunchItems?: string[];
  supperItems?: string[];
}

interface AllCalories {
  [dateKey: string]: MealCalories;
}
// --- End Updated Types ---

// New Type for Meal Plan
interface MealPlan {
    breakfast: string[];
    lunch: string[];
    supper: string[];
}

const PROFILE_STORAGE_KEY = "caloai-healthProfile";
const CALORIES_STORAGE_KEY = "caloai-dailyCalories";
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
  const { address } = useAccount();
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [allCalories, setAllCalories] = useState<AllCalories>({});
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingCalories, setIsLoadingCalories] = useState(true);

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
      const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
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
    try {
      const storedCalories = localStorage.getItem(CALORIES_STORAGE_KEY);
      if (storedCalories) {
         const parsed = JSON.parse(storedCalories);
         if (parsed && typeof parsed === 'object') { // Basic validation
            setAllCalories(parsed as AllCalories);
         } else {
             localStorage.removeItem(CALORIES_STORAGE_KEY); // Clear invalid data
         }
      }
    } catch (error) {
      console.error("Failed to load calories:", error);
    } finally {
      setIsLoadingCalories(false);
    }
  }, []);

  // --- Load Meal Plan Data ---
  useEffect(() => {
    setIsLoadingMealPlan(true);
    try {
      const storedPlan = localStorage.getItem(MEAL_PLAN_STORAGE_KEY);
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
    const today = new Date();
    const todayKey = formatDateKey(today);
    const todaysData = allCalories[todayKey] || { breakfast: 0, lunch: 0, supper: 0 };
    const totalToday = calculateDailyTotal(todaysData);

    const calorieTarget = profile?.calorieTarget ? Number(profile.calorieTarget) : 0;
    const caloriesRemaining = calorieTarget > 0 ? Math.max(0, calorieTarget - totalToday) : null;
    const progressPercent = calorieTarget > 0 && totalToday > 0 ? Math.min(100, (totalToday / calorieTarget) * 100) : 0;

    // --- Weekly Chart Data Calculation ---
    let weeklyTotal = 0;
    let daysLoggedForAvg = 0; // Use a separate counter for average calculation
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateKey = formatDateKey(date);
        const dayData = allCalories[dateKey];
        const dayTotal = dayData ? calculateDailyTotal(dayData) : 0;

        // Only count days with actual logs towards the weekly average shown
        if (dayData) {
            weeklyTotal += dayTotal;
            daysLoggedForAvg++;
        }

        chartData.push({
            name: date.toLocaleDateString('en-US', { weekday: 'short' }),
            calories: dayTotal,
        });
    }
    const averageWeekly = daysLoggedForAvg > 0 ? Math.round(weeklyTotal / daysLoggedForAvg) : 0;
    // --- End Weekly Chart Data Calculation ---


    // --- Overall Common Foods & All Logged Foods Calculation ---
    const allItemsFrequency: { [item: string]: number } = {};
    const uniqueLoggedFoods = new Set<string>(); // Use a Set for uniqueness

    Object.values(allCalories).forEach(dayData => {
        if (dayData) {
            const processItems = (items: string[] | undefined) => {
                (items || []).forEach(item => {
                    const lowerItem = item.toLowerCase();
                    allItemsFrequency[lowerItem] = (allItemsFrequency[lowerItem] || 0) + 1;
                    uniqueLoggedFoods.add(lowerItem); // Add to Set for unique list
                });
            };
            processItems(dayData.breakfastItems);
            processItems(dayData.lunchItems);
            processItems(dayData.supperItems);
        }
    });

    // Get top 5 common foods
    const commonFoods = Object.entries(allItemsFrequency)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 5)
        .map(([item]) => item);

    // Convert Set to sorted array for display
    const allLoggedFoods = Array.from(uniqueLoggedFoods).sort();
    // --- End Calculations ---


    return {
        totalToday, caloriesRemaining, progressPercent, todaysData,
        averageWeekly, // Based on last 7 logged days
        chartData, // Last 7 days
        commonFoods, // Based on ALL loaded data
        allLoggedFoods, // <-- Add the new list here
        hasTarget: calorieTarget > 0,
        calorieTarget
    };
  }, [profile, allCalories]);

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
      .catch((error: any) => {
        console.error("Failed to fetch recommendations:", error);
        setErrorRecs(error.message || "Could not load suggestions.");
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
                            <p className="text-2xl font-bold text-[var(--app-foreground)]">{analytics.totalToday}</p>
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
            {analytics.totalToday > 0 ? (
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                        <p className="text-lg font-semibold text-[var(--app-foreground)]">{analytics.todaysData.breakfast || 0}</p>
                        <p className="text-xs text-[var(--app-foreground-muted)]">🍳 Breakfast</p>
                    </div>
                    <div>
                        <p className="text-lg font-semibold text-[var(--app-foreground)]">{analytics.todaysData.lunch || 0}</p>
                        <p className="text-xs text-[var(--app-foreground-muted)]">🥪 Lunch</p>
                    </div>
                    <div>
                        <p className="text-lg font-semibold text-[var(--app-foreground)]">{analytics.todaysData.supper || 0}</p>
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
                    Average daily intake (last 7 logged days): <span className="font-semibold text-[var(--app-foreground)]">{analytics.averageWeekly} kcal</span>
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