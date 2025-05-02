"use client";

import Link from "next/link";
import { Card, Button } from "../components/DemoComponents"; // Adjust path as needed
import { useState, useEffect, useCallback, useRef } from "react";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Default styling for the calendar
import CameraModal from './CameraModal'; // <-- Import the new component

// --- Types ---
type HealthGoal = "weight_loss" | "weight_gain" | "maintenance";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

// Ensure this interface is defined within the file or imported
interface HealthProfile {
  age: number | ""; gender: string; height: number | ""; weight: number | "";
  goal: HealthGoal; activityLevel: ActivityLevel; restrictions: string;
  calorieTarget: number | "";
}

// Define the structure for daily calorie data
interface MealCalories {
  breakfast: number | "";
  lunch: number | "";
  supper: number | "";
  // Add optional item lists identified by AI
  breakfastItems?: string[];
  lunchItems?: string[];
  supperItems?: string[];
}

// Define the structure for all stored calorie data
interface AllCalories {
  [dateKey: string]: MealCalories; // Key is YYYY-MM-DD string
}

const CALORIES_STORAGE_KEY = "caloai-dailyCalories";
const PROFILE_STORAGE_KEY = "caloai-healthProfile";
const MEAL_PLAN_STORAGE_KEY = "caloai-mealPlan";

// Helper function to format date as YYYY-MM-DD
const formatDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export default function TrackPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [allCalories, setAllCalories] = useState<AllCalories>({});
  const [currentCalories, setCurrentCalories] = useState<MealCalories>({
    breakfast: "",
    lunch: "",
    supper: "",
    breakfastItems: [], // Initialize item arrays
    lunchItems: [],
    supperItems: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  // State for Camera Modal
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraForMeal, setCameraForMeal] = useState<'breakfast' | 'lunch' | 'supper' | null>(null);

  // State for AI analysis loading
  const [isAnalyzing, setIsAnalyzing] = useState<null | 'breakfast' | 'lunch' | 'supper'>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // State for Save Changes loading
  const [isSaving, setIsSaving] = useState(false);

  // State for meal plan generation status
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planGenerationError, setPlanGenerationError] = useState<string | null>(null);

  // Refs for hidden file inputs
  const breakfastFileRef = useRef<HTMLInputElement>(null);
  const lunchFileRef = useRef<HTMLInputElement>(null);
  const supperFileRef = useRef<HTMLInputElement>(null);

  // --- Local Storage Logic ---

  // Load data from local storage on mount
  useEffect(() => {
    setIsLoading(true);
    try {
      const storedData = localStorage.getItem(CALORIES_STORAGE_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        // Basic validation
        if (typeof parsedData === 'object' && parsedData !== null) {
          setAllCalories(parsedData);
        } else {
           console.warn("Invalid calorie data found in local storage.");
           localStorage.removeItem(CALORIES_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("Failed to load calorie data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save data to local storage whenever allCalories changes
  useEffect(() => {
    // Don't save during initial load
    if (!isLoading) {
      try {
        localStorage.setItem(CALORIES_STORAGE_KEY, JSON.stringify(allCalories));
      } catch (error) {
        console.error("Failed to save calorie data:", error);
        // Show error to user?
      }
    }
  }, [allCalories, isLoading]);

  // --- State Update Logic ---

  // Update currentCalories when selectedDate changes
  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    const todaysLog = allCalories[dateKey];
    // Set defaults including empty item arrays if no log exists for the day
    setCurrentCalories(
      todaysLog || {
        breakfast: "", lunch: "", supper: "",
        breakfastItems: [], lunchItems: [], supperItems: []
      }
    );
  }, [selectedDate, allCalories]);

  // Handle date selection from calendar
  const handleDateChange = (value: any) => { // Type from react-calendar can be complex
    if (value instanceof Date) {
      setSelectedDate(value);
    } else if (Array.isArray(value) && value[0] instanceof Date) {
      // Handle range selection if enabled (though we're not using it here)
      setSelectedDate(value[0]);
    }
  };

  // Handle changes in calorie input fields
  const handleCalorieInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentCalories((prev) => ({
      ...prev,
      [name]: value === "" ? "" : Number(value), // Store as number or empty string
    }));
  };

  // Save the current day's calories
  const handleSaveChanges = useCallback(() => {
    setIsSaving(true);
    try {
        const dateKey = formatDateKey(selectedDate);
        // Clean only the number inputs, keep items as they are
        const cleanedCalories: MealCalories = {
            ...currentCalories, // Keep existing items arrays
            breakfast: currentCalories.breakfast === "" ? "" : Number(currentCalories.breakfast),
            lunch: currentCalories.lunch === "" ? "" : Number(currentCalories.lunch),
            supper: currentCalories.supper === "" ? "" : Number(currentCalories.supper),
        };

        // Check if any calorie value is entered OR if any items were identified
        const hasCalorieData = cleanedCalories.breakfast !== "" || cleanedCalories.lunch !== "" || cleanedCalories.supper !== "";
        const hasItemData = (cleanedCalories.breakfastItems?.length ?? 0) > 0 ||
                            (cleanedCalories.lunchItems?.length ?? 0) > 0 ||
                            (cleanedCalories.supperItems?.length ?? 0) > 0;

        if (hasCalorieData || hasItemData) {
            setAllCalories((prev) => ({ ...prev, [dateKey]: cleanedCalories }));
            console.log(`Saved data for ${dateKey}:`, cleanedCalories);
        } else {
            // Remove entry if no calories AND no items
            setAllCalories((prev) => {
                const newState = { ...prev };
                delete newState[dateKey];
                return newState;
            });
             console.log(`Cleared data for ${dateKey}`);
        }
    } catch (error) {
        console.error("Error saving changes:", error);
    } finally {
        setIsSaving(false);
    }
  }, [selectedDate, currentCalories]);

  // --- Camera Logic ---
  const openCamera = (mealType: 'breakfast' | 'lunch' | 'supper') => {
    setCameraForMeal(mealType);
    setIsCameraModalOpen(true);
  };

  const handleCaptureSuccess = () => {
    if (cameraForMeal) {
      setCurrentCalories((prev) => ({
        ...prev,
        [cameraForMeal]: 400, // Set fixed calorie amount
      }));
    }
    // Modal closing is handled internally now by CameraModal on success/cancel
    // setIsCameraModalOpen(false); // No longer needed here
    setCameraForMeal(null);
  };

  // --- File Upload Logic ---
  const handleUploadClick = (mealType: 'breakfast' | 'lunch' | 'supper') => {
    if (isAnalyzing) return; // Prevent upload while analyzing
    setAnalysisError(null); // Clear previous errors
    switch (mealType) {
      case 'breakfast': breakfastFileRef.current?.click(); break;
      case 'lunch': lunchFileRef.current?.click(); break;
      case 'supper': supperFileRef.current?.click(); break;
    }
  };

  const handleFileChange = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
    mealType: 'breakfast' | 'lunch' | 'supper'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(mealType);
    setAnalysisError(null);
    setPlanGenerationError(null); // Clear previous plan errors

    // 1. Get current unique foods BEFORE analysis
    const previousUniqueFoods = calculateUniqueFoods(allCalories);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Image = reader.result as string;

        // Call your analysis API
        const response = await fetch('/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64Image }),
        });

        const data = await response.json();
        console.log("AI Analysis Response:", data);

        if (!response.ok) {
          throw new Error(data.error || `Image analysis failed (${response.status})`);
        }

        // Update current day's calories and items
        const newCalories = data.estimatedCalories !== null ? Number(data.estimatedCalories) : "";
        const newItems = data.foodItems || [];
        const mealItemsKey = `${mealType}Items` as keyof MealCalories; // e.g., 'breakfastItems'

        // Create the updated state for the current day
        const updatedCurrentDayCalories = {
            ...currentCalories,
            [mealType]: newCalories,
            [mealItemsKey]: newItems,
        };
        setCurrentCalories(updatedCurrentDayCalories); // Update UI immediately

        // Update the allCalories state immutably
        const dateKey = formatDateKey(selectedDate);
        const updatedAllCalories = {
            ...allCalories,
            [dateKey]: {
                // Ensure we merge with existing data for the day if any
                ...(allCalories[dateKey] || { breakfast: "", lunch: "", supper: "" }), // Start with existing or default
                ...updatedCurrentDayCalories // Apply the updates
            }
        };
        setAllCalories(updatedAllCalories); // Update the main state

        // 2. Get new unique foods AFTER analysis and state update
        const newUniqueFoods = calculateUniqueFoods(updatedAllCalories);

        // 3. Check if the set of unique foods has changed
        let foodListChanged = newUniqueFoods.size !== previousUniqueFoods.size;
        if (!foodListChanged) {
            // If sizes are same, check if any new item is not in old set
            for (const item of Array.from(newUniqueFoods)) {
                if (!previousUniqueFoods.has(item)) {
                    foodListChanged = true;
                    break;
                }
            }
        }

        // 4. If changed, AND profile exists, trigger meal plan generation
        if (foodListChanged) {
            console.log("New unique food detected, triggering meal plan generation...");
            setIsGeneratingPlan(true);
            try {
                // Check if profile exists and has necessary info
                const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
                if (!storedProfile) {
                    throw new Error("User profile not found. Cannot generate meal plan.");
                }
                const profile: HealthProfile = JSON.parse(storedProfile);
                if (!profile.goal || !profile.calorieTarget) {
                     throw new Error("Profile goal or calorie target missing. Cannot generate meal plan.");
                }

                const planResponse = await fetch('/api/generate-meal-plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        healthGoal: profile.goal,
                        calorieTarget: Number(profile.calorieTarget),
                        allLoggedFoods: Array.from(newUniqueFoods), // Send the updated list
                    }),
                });

                const planData = await planResponse.json();
                if (!planResponse.ok) {
                    throw new Error(planData.error || `Meal plan generation failed (${planResponse.status})`);
                }

                // 5. Store the new meal plan
                localStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify(planData));
                console.log("New meal plan generated and saved.");
                setPlanGenerationError(null); // Clear error on success

            } catch (planError: any) {
                console.error("Meal plan generation error:", planError);
                setPlanGenerationError(planError.message || "Failed to generate meal plan.");
                // Don't clear the stored plan on error, keep the old one
            } finally {
                setIsGeneratingPlan(false);
            }
        } else {
             console.log("No new unique foods detected, meal plan not regenerated.");
        }
      };
      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        setAnalysisError("Failed to read image file.");
        setIsAnalyzing(null);
      };
    } catch (error: any) {
      console.error("Image analysis fetch error:", error);
      setAnalysisError(error.message || "Failed to analyze image.");
      setIsAnalyzing(null);
    } finally {
       // Reset file input to allow uploading the same file again if needed
       if (event.target) event.target.value = '';
       // Keep isAnalyzing state until plan generation is also complete if triggered
       if (!isGeneratingPlan) {
           setIsAnalyzing(null);
       }
    }
  }, [allCalories, currentCalories, selectedDate, isGeneratingPlan]); // Added isGeneratingPlan dependency

  // --- Helper Function ---
  const calculateUniqueFoods = (allCalData: AllCalories): Set<string> => {
    const uniqueFoods = new Set<string>();
    Object.values(allCalData).forEach(dayData => {
        if (dayData) {
            (dayData.breakfastItems || []).forEach(item => uniqueFoods.add(item.toLowerCase()));
            (dayData.lunchItems || []).forEach(item => uniqueFoods.add(item.toLowerCase()));
            (dayData.supperItems || []).forEach(item => uniqueFoods.add(item.toLowerCase()));
        }
    });
    return uniqueFoods;
  };

  // --- Styling ---
  const inputClasses = "mt-1 block w-full px-3 py-2 bg-[var(--app-card-bg)] border border-[var(--app-card-border)] rounded-md text-[var(--app-foreground)] placeholder-[var(--app-foreground-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"; // Added styles to hide number spinners
  const labelClasses = "block text-sm font-medium text-[var(--app-foreground-muted)]";

  // --- Render ---

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading Tracker...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
        <div className="w-full max-w-md mx-auto px-4 py-3">
          <header className="flex justify-between items-center mb-6 h-11">
            <h1 className="text-xl font-semibold">Track Calories</h1>
            <Link href="/">
              <Button variant="outline" size="sm">
                Back Home
              </Button>
            </Link>
          </header>

          <main className="flex-1 space-y-6">
            {/* Calendar Card */}
            <Card title="Select Date">
              {/* Apply theme variables to calendar container if needed */}
              <div className="calorie-calendar-container p-2 rounded-lg bg-[var(--app-gray)] border border-[var(--app-card-border)]">
                <Calendar
                  onChange={handleDateChange}
                  value={selectedDate}
                  maxDate={new Date()} // Don't allow future dates
                  className="react-calendar-override" // Add custom class for overrides
                />
              </div>
            </Card>

            {/* Calorie Entry Card */}
            <Card title={`Log Calories for ${selectedDate.toLocaleDateString()}`}>
              {analysisError && ( // Display analysis errors prominently
                <p className="text-red-500 text-sm text-center bg-red-100 p-2 rounded mb-4">{analysisError}</p>
              )}
              <div className="space-y-4">
                {/* Breakfast */}
                <div>
                  <label htmlFor="breakfast" className={labelClasses}>🍳 Breakfast Calories</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      id="breakfast"
                      name="breakfast"
                      value={currentCalories.breakfast}
                      onChange={handleCalorieInputChange}
                      className={inputClasses + " flex-grow"}
                      placeholder={isAnalyzing === 'breakfast' ? "Analyzing..." : "e.g., 350"}
                      min="0"
                      disabled={isAnalyzing === 'breakfast'} // Disable input while analyzing
                    />
                    {/* Hidden File Input */}
                    <input
                      type="file"
                      ref={breakfastFileRef}
                      onChange={(e) => handleFileChange(e, 'breakfast')}
                      accept="image/*" // Accept only image files
                      className="hidden"
                      aria-hidden="true"
                      disabled={!!isAnalyzing}
                    />
                    {/* Upload Button */}
                    <Button variant="secondary" size="sm" onClick={() => handleUploadClick('breakfast')} aria-label="Upload breakfast image" disabled={!!isAnalyzing}>
                      {isAnalyzing === 'breakfast' ? (
                        <SpinnerIcon /> // Replace with your spinner component/SVG
                      ) : (
                        <UploadIcon /> // Replace with your upload icon SVG
                      )}
                    </Button>
                    {/* Camera Button */}
                    <Button variant="secondary" size="sm" onClick={() => openCamera('breakfast')} aria-label="Scan breakfast" disabled={!!isAnalyzing}>
                      <CameraIcon /> {/* Replace with your camera icon SVG */}
                    </Button>
                  </div>
                </div>
                {/* Lunch */}
                <div>
                  <label htmlFor="lunch" className={labelClasses}>🥪 Lunch Calories</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      id="lunch"
                      name="lunch"
                      value={currentCalories.lunch}
                      onChange={handleCalorieInputChange}
                      className={inputClasses + " flex-grow"}
                      placeholder={isAnalyzing === 'lunch' ? "Analyzing..." : "e.g., 600"}
                      min="0"
                      disabled={isAnalyzing === 'lunch'}
                    />
                    {/* Hidden File Input */}
                    <input type="file" ref={lunchFileRef} onChange={(e) => handleFileChange(e, 'lunch')} accept="image/*" className="hidden" aria-hidden="true" disabled={!!isAnalyzing}/>
                    {/* Upload Button */}
                    <Button variant="secondary" size="sm" onClick={() => handleUploadClick('lunch')} aria-label="Upload lunch image" disabled={!!isAnalyzing}>
                      {isAnalyzing === 'lunch' ? <SpinnerIcon /> : <UploadIcon />}
                    </Button>
                    {/* Camera Button */}
                    <Button variant="secondary" size="sm" onClick={() => openCamera('lunch')} aria-label="Scan lunch" disabled={!!isAnalyzing}>
                      <CameraIcon />
                    </Button>
                  </div>
                </div>
                {/* Supper */}
                <div>
                  <label htmlFor="supper" className={labelClasses}>🍲 Supper Calories</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      id="supper"
                      name="supper"
                      value={currentCalories.supper}
                      onChange={handleCalorieInputChange}
                      className={inputClasses + " flex-grow"}
                      placeholder={isAnalyzing === 'supper' ? "Analyzing..." : "e.g., 500"}
                      min="0"
                      disabled={isAnalyzing === 'supper'}
                    />
                    {/* Hidden File Input */}
                    <input type="file" ref={supperFileRef} onChange={(e) => handleFileChange(e, 'supper')} accept="image/*" className="hidden" aria-hidden="true" disabled={!!isAnalyzing}/>
                    {/* Upload Button */}
                    <Button variant="secondary" size="sm" onClick={() => handleUploadClick('supper')} aria-label="Upload supper image" disabled={!!isAnalyzing}>
                      {isAnalyzing === 'supper' ? <SpinnerIcon /> : <UploadIcon />}
                    </Button>
                    {/* Camera Button */}
                    <Button variant="secondary" size="sm" onClick={() => openCamera('supper')} aria-label="Scan supper" disabled={!!isAnalyzing}>
                      <CameraIcon />
                    </Button>
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSaveChanges}
                  variant="primary"
                  className="w-full flex justify-center items-center"
                  disabled={!!isAnalyzing || isSaving || isGeneratingPlan}
                >
                  {isSaving ? (
                    <SpinnerIcon />
                  ) : isAnalyzing || isGeneratingPlan ? (
                    "Processing..."
                  ) : (
                    `Save Changes for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  )}
                </Button>
              </div>
            </Card>
          </main>
        </div>
        {/* Add custom calendar styles if needed */}
        <style jsx global>{`
          .calorie-calendar-container .react-calendar {
            border: none; /* Remove default border */
            width: 100%;
            background-color: transparent; /* Inherit background */
            font-family: inherit; /* Use app font */
          }
          .calorie-calendar-container .react-calendar__tile {
            color: var(--app-foreground);
            border-radius: 0.375rem; /* rounded-md */
          }
          .calorie-calendar-container .react-calendar__tile:enabled:hover,
          .calorie-calendar-container .react-calendar__tile:enabled:focus {
            background-color: var(--app-accent-light); /* Use theme accent light */
          }
          .calorie-calendar-container .react-calendar__tile--now {
            background-color: var(--app-accent-light);
            font-weight: bold;
          }
          .calorie-calendar-container .react-calendar__tile--active {
            background-color: var(--app-accent) !important; /* Use theme accent */
            color: var(--app-background) !important; /* Use theme background for text */
          }
          .calorie-calendar-container .react-calendar__tile:disabled {
            color: var(--app-foreground-muted) !important; /* Use muted text color */
            background-color: transparent !important; /* Ensure background isn't overriding */
            opacity: 0.6; /* Optional: make them slightly faded */
          }
           .calorie-calendar-container .react-calendar__navigation button {
              color: var(--app-accent);
              font-weight: bold;
              min-width: 40px; /* Adjust spacing */
           }
           .calorie-calendar-container .react-calendar__month-view__weekdays__weekday {
              color: var(--app-foreground-muted);
              text-decoration: none; /* Remove underline */
              font-size: 0.8em;
              text-transform: uppercase;
           }
           /* Add more overrides as needed */
        `}</style>
      </div>

      {/* Render Camera Modal (using the imported component) */}
      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)} // Still need onClose to set state
        onCaptureSuccess={handleCaptureSuccess}
        
        mealType={cameraForMeal}
      />
    </>
  );
}

// --- Helper Icon Components (replace with actual SVGs or library icons) ---
function UploadIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
}
function CameraIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2H4zm12 3a1 1 0 10-2 0v2a1 1 0 102 0V8zm-5 4a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>;
}
function SpinnerIcon() {
    return (
        <svg className="animate-spin h-5 w-5 text-[var(--app-foreground)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    );
} 