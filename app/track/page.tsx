"use client";

import Link from "next/link";
import { Card, Button } from "../components/DemoComponents"; // Adjust path as needed
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Default styling for the calendar
import CameraModal from './CameraModal'; // <-- Import the new component
import { useAccount } from "wagmi"; // <-- Import useAccount

// --- Reward System Imports ---
import { getUserData, saveUserData, UserData, getTodayDateString, getYesterdayDateString } from '@/src/lib/userData'; // Adjust path
import { checkAndAwardMilestones } from '@/src/lib/rewards'; // Adjust path
import { HealthProfile, AllCalories, MealCalories, CalorieLogEntry } from "@/src/lib/types"; // Assuming types are defined here
import { estimateCalories } from "@/src/lib/calorieEstimation"; // Import estimation function
import { MILESTONES } from "@/src/config/milestones"; // Import MILESTONES if not already
// --- End Reward System Imports ---

// --- Types ---
// type HealthGoal = "weight_loss" | "weight_gain" | "maintenance";
// type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

// // Ensure this interface is defined within the file or imported
// interface HealthProfile {
//   age: number | ""; gender: string; height: number | ""; weight: number | "";
//   goal: HealthGoal; activityLevel: ActivityLevel; restrictions: string;
//   calorieTarget: number | "";
// }

// Define the structure for daily calorie data
// interface MealCalories {
//   breakfast: number | "";
//   lunch: number | "";
//   supper: number | "";
//   // Add optional item lists identified by AI
//   breakfastItems?: string[];
//   lunchItems?: string[];
//   supperItems?: string[];
// }

// // Define the structure for all stored calorie data
// interface AllCalories {
//   [dateKey: string]: MealCalories; // Key is YYYY-MM-DD string
// }

const CALORIES_STORAGE_KEY = "caloai-allCalories";
const PROFILE_STORAGE_KEY = "caloai-healthProfile";
const MEAL_PLAN_STORAGE_KEY = "caloai-mealPlan";

// Helper function to format date as YYYY-MM-DD
const formatDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Define the possible value types returned by react-calendar onChange
type ValuePiece = Date | null;
type CalendarValue = ValuePiece | [ValuePiece, ValuePiece];

// Define MealCalories structure (if not imported from types.ts)
// interface MealCalories {
//   breakfast: number | "";
//   lunch: number | "";
//   supper: number | "";
//   breakfastItems?: CalorieLogEntry[]; // Use CalorieLogEntry array
//   lunchItems?: CalorieLogEntry[];     // Use CalorieLogEntry array
//   supperItems?: CalorieLogEntry[];    // Use CalorieLogEntry array
// // }

// // Define AllCalories structure (if not imported from types.ts)
// interface AllCalories {
//   [dateKey: string]: MealCalories; // Key is YYYY-MM-DD string
// }

export default function TrackPage() {
  const { address, isConnected } = useAccount();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // Initialize allCalories as an empty object for the date-keyed structure
  const [allCalories, setAllCalories] = useState<AllCalories>({});
  // currentCalories remains the structure for the selected day's meals
  const [currentCalories, setCurrentCalories] = useState<MealCalories>({
    breakfast: "",
    lunch: "",
    supper: "",
    breakfastItems: [],
    lunchItems: [],
    supperItems: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<HealthProfile | null>(null);

  // State for Camera Modal
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [currentMealType, setCurrentMealType] = useState<'breakfast' | 'lunch' | 'supper' | null>(null);

  // State for AI analysis loading
  const [isAnalyzing, setIsAnalyzing] = useState<null | 'breakfast' | 'lunch' | 'supper'>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // State for Save Changes loading
  const [isSaving, setIsSaving] = useState(false);

  // State for meal plan generation status
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  // const [planGenerationError, setPlanGenerationError] = useState<string | null>(null);

  // State for estimation results
  const [estimationResult, setEstimationResult] = useState<string | null>(null);
  const [estimationError, setEstimationError] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  // Refs for hidden file inputs
  const breakfastFileRef = useRef<HTMLInputElement>(null);
  const lunchFileRef = useRef<HTMLInputElement>(null);
  const supperFileRef = useRef<HTMLInputElement>(null);

  // --- Combined Initial Data Loading ---
  useEffect(() => {
    console.log("TrackPage: Starting initial data load...");
    setIsLoading(true); // Set loading true at the start

    if (!address) {
        console.log("TrackPage: No address, skipping load.");
        setProfile(null);
        setAllCalories({}); // Reset to empty object
        setIsLoading(false); // Finish loading state
        return;
    }

    let loadedProfile: HealthProfile | null = null;
    let loadedCalories: AllCalories = {};

    try {
      // Load Profile
      const profileKey = `${PROFILE_STORAGE_KEY}-${address}`;
      console.log("TrackPage: Loading profile from key:", profileKey);
      const storedProfile = localStorage.getItem(profileKey);
      if (storedProfile) {
        try {
          loadedProfile = JSON.parse(storedProfile) as HealthProfile;
          console.log("TrackPage: Profile loaded.");
        } catch (e) {
          console.error("TrackPage: Failed to parse stored profile:", e);
          localStorage.removeItem(profileKey);
        }
      } else {
        console.log("TrackPage: No profile found in storage.");
      }

      // Load Calories
      const caloriesKey = `${CALORIES_STORAGE_KEY}-${address}`;
      console.log("TrackPage: Loading calories from key:", caloriesKey);
      const storedCalories = localStorage.getItem(caloriesKey);
      if (storedCalories) {
        try {
          // Ensure the loaded data is treated as AllCalories (date-keyed)
          const parsedCalories = JSON.parse(storedCalories);
          if (parsedCalories && typeof parsedCalories === 'object') {
              loadedCalories = parsedCalories as AllCalories;
              console.log("TrackPage: Calories loaded.");
          } else {
              console.warn("TrackPage: Invalid calorie data found, clearing.");
              localStorage.removeItem(caloriesKey);
          }
        } catch (e) {
          console.error("TrackPage: Failed to parse stored calories:", e);
          localStorage.removeItem(caloriesKey);
        }
      } else {
        console.log("TrackPage: No calories found in storage.");
      }

    } catch (error) {
      console.error("TrackPage: Error during initial data loading:", error);
    } finally {
      // Set state AFTER loading attempts
      setProfile(loadedProfile);
      setAllCalories(loadedCalories);
      console.log("TrackPage: Finished initial data load attempt. Setting isLoading to false.");
      setIsLoading(false); // Set loading to false AFTER attempting to load everything
    }
  // Add address to dependency array
  }, [address]);

  // --- Save ALL Calories to LS (Date-Keyed Structure) ---
  useEffect(() => {
    // Prevent saving during the initial load phase or if no address
    if (!isLoading && address) {
      try {
        const key = `${CALORIES_STORAGE_KEY}-${address}`;
        console.log(`TrackPage: Saving allCalories to LS key ${key}:`, allCalories);
        // Save the entire date-keyed allCalories object
        localStorage.setItem(key, JSON.stringify(allCalories));
      } catch (error) {
        console.error("TrackPage: Failed to save calories to localStorage:", error);
      }
    }
  // Add address to dependency array
  }, [allCalories, isLoading, address]);

  // --- Load data for the selected date ---
  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    const dayData = allCalories[dateKey];

    // Ensure each meal type defaults to an empty array if not found or not an array
    setCurrentCalories({
      breakfast: Array.isArray(dayData?.breakfast) ? dayData.breakfast : [],
      lunch: Array.isArray(dayData?.lunch) ? dayData.lunch : [],
      supper: Array.isArray(dayData?.supper) ? dayData.supper : [],
    });

  }, [selectedDate, allCalories]); // Dependencies: run when date or main data changes

  // --- Handle Manual Calorie Input Change ---
  const handleCalorieInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target; // name is 'breakfast', 'lunch', or 'supper'
    const numericValue = value === "" ? "" : Number(value); // Keep empty string or convert to number

    // Update the currentCalories state for the UI
    setCurrentCalories(prev => ({
      ...prev,
      [name]: numericValue,
    }));
    // Note: This only updates the *display* state. Saving happens in handleSaveChanges.
  };


  // --- Handle Saving Manually Entered/Edited Calories ---
  const handleSaveChanges = useCallback(async () => {
    if (!address) {
      console.error("Save Error: No address connected.");
      // Optionally show a user-facing error
      return;
    }
    setIsSaving(true);
    console.log("Saving changes for date:", formatDateKey(selectedDate));

    try {
      // 1. Get current user data (needed for comparison)
      const currentUserData = getUserData(address); // Make sure getUserData is imported

      // 2. Prepare the next state of allCalories
      const dateKey = formatDateKey(selectedDate);
      const nextAllCalories = {
        ...allCalories, // Spread existing data
        [dateKey]: { // Update or add data for the selected date
          ...currentCalories, // Use the state holding the form inputs
          // Ensure numeric conversion happens here if inputs are strings
          breakfast: Number(currentCalories.breakfast) || 0,
          lunch: Number(currentCalories.lunch) || 0,
          supper: Number(currentCalories.supper) || 0,
          // Keep item arrays as they are
          breakfastItems: currentCalories.breakfastItems || [],
          lunchItems: currentCalories.lunchItems || [],
          supperItems: currentCalories.supperItems || [],
        },
      };

      // 3. Call the rewards check function with the *next* state
      // Pass the current profile state as well
      const updatedUserData = checkAndAwardMilestones(
          currentUserData,
          nextAllCalories,
          profile // Pass the loaded profile state
      );

      // 4. Save both the updated calories and the updated user data
      saveUserData(address, updatedUserData); // Save updated points/streak/milestones
      localStorage.setItem(`${CALORIES_STORAGE_KEY}-${address}`, JSON.stringify(nextAllCalories));

      // 5. Update local state
      setAllCalories(nextAllCalories); // Update the main calorie state

      console.log("Changes saved successfully. Updated UserData:", updatedUserData);
      // Optionally show a success message to the user

    } catch (error) {
      console.error("Failed to save changes:", error);
      // Optionally show a user-facing error message
    } finally {
      setIsSaving(false);
    }
  }, [address, selectedDate, currentCalories, allCalories, profile]); // Add profile to dependencies


  // Helper function to read file as Data URL
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Basic check before reading
      if (!file.type.startsWith('image/')) {
          return reject(new Error("Invalid file type. Please select an image."));
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
          console.log("FileReader Success (first 100 chars):", reader.result.substring(0, 100)); // Log result
          resolve(reader.result);
        } else {
           console.error("FileReader result is not a valid data URL string:", typeof reader.result, reader.result?.substring(0,100));
          reject(new Error("Failed to read file as valid image data URL."));
        }
      };
      reader.onerror = (error) => {
        console.error("FileReader error:", error); // Log error
        reject(new Error("Error reading file.")); // Provide a generic error
      };
      reader.readAsDataURL(file); // Read the file content as Data URL
    });
  };


  // Handle file input change
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, mealType: 'breakfast' | 'lunch' | 'supper') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input value so the same file can be selected again if needed
    event.target.value = '';

    console.log(`File selected for ${mealType}:`, file.name, file.type);

    // Early type check (redundant with check in readFileAsDataURL but good practice)
    if (!file.type.startsWith('image/')) {
        setAnalysisError("Please select an image file.");
        return;
    }

    setIsAnalyzing(mealType); // Indicate loading early
    setAnalysisError(null);
    setEstimationResult(null);

    try {
      // Read the file using the helper
      const imageDataUrl = await readFileAsDataURL(file);
      // Directly call handleCaptureSuccess with the result
      // handleCaptureSuccess will perform the API call
      await handleCaptureSuccess(imageDataUrl, mealType);
    } catch (error: any) {
      console.error("Error reading file or processing upload:", error);
      setAnalysisError(error.message || "Failed to read or process file.");
      setIsAnalyzing(null); // Ensure loading state is reset on error
    }
  };


  // --- Handle Successful Camera Capture (or file upload result) ---
  const handleCaptureSuccess = useCallback(async (imageDataUrl: string, mealType: 'breakfast' | 'lunch' | 'supper') => {
    if (!address) {
        console.error("Capture Error: No address connected.");
        setAnalysisError("Connect wallet to analyze images.");
        return;
    }
    if (!mealType) return; // Should not happen if called correctly

    console.log(`Handling capture/upload success for ${mealType}`);

    // --- Add Client-Side Validation ---
    if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
        console.error("Invalid imageDataUrl received in handleCaptureSuccess (first 100 chars):", imageDataUrl?.substring(0, 100));
        setAnalysisError("Invalid image data format detected before sending.");
        setIsAnalyzing(null); // Reset loading state if applicable
        return; // Stop processing
    }
    console.log("Image Data URL seems valid (first 100 chars):", imageDataUrl.substring(0, 100));
    // --- End Client-Side Validation ---

    setIsAnalyzing(mealType); // Ensure loading state is set
    setAnalysisError(null);
    setEstimationResult(null);

    try {
        const response = await fetch('/api/analyze-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageDataUrl }), // Send the validated data URL
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
            // Throw an error that includes the message from the API response
            throw new Error(errorData.error || `API request failed with status: ${response.status}`);
        }

        const data = await response.json();
        console.log("AI Analysis Result:", data);

        // --- START: Correctly Update State and Save with Rewards ---

        // 1. Create a new CalorieLogEntry for the AI result
        const estimatedCalories = data.estimatedCalories !== null ? Number(data.estimatedCalories) : 0;
        const foodItems: string[] = Array.isArray(data.foodItems) ? data.foodItems : [];
        const newLogEntry: CalorieLogEntry = {
            id: Date.now().toString(), // Simple unique ID
            timestamp: new Date().toISOString(),
            source: 'ai',
            items: foodItems,
            estimatedCalories: estimatedCalories,
        };

        // 2. Prepare the *next* state of allCalories
        const dateKey = formatDateKey(selectedDate);
        // Get current day's data, defaulting to empty arrays if it doesn't exist
        const currentDayData = allCalories[dateKey] || { breakfast: [], lunch: [], supper: [] };
        // Determine the correct key for the meal's item list (e.g., 'breakfast', 'lunch', 'supper')
        const mealItemsKey = mealType as keyof MealCalories; // 'breakfast', 'lunch', or 'supper'

        const nextDayData: MealCalories = {
            ...currentDayData,
            // Append the new AI log entry to the items list for that meal
            [mealItemsKey]: [...(currentDayData[mealItemsKey] || []), newLogEntry],
        };

        const nextAllCalories = {
            ...allCalories,
            [dateKey]: nextDayData,
        };

        // 3. Get current user data (needed for rewards check)
        const currentUserData = getUserData(address);
        if (!currentUserData) {
          // Handle case where user data might not be loaded yet, though it should be
          console.error("User data not found. Cannot update milestones.");
          setAnalysisError("User data not found. Please refresh.");
          setIsAnalyzing(null);
          return; // Stop processing if user data is missing
        }

        // 4. Call rewards check with the *next* state of calories
        const updatedUserData = checkAndAwardMilestones(
            currentUserData,
            nextAllCalories, // Pass the state *after* adding the new entry
            profile
        );

        // 5. Save updated data (both calories and user data)
        saveUserData(address, updatedUserData);
        localStorage.setItem(`${CALORIES_STORAGE_KEY}-${address}`, JSON.stringify(nextAllCalories));

        // 6. Update local state for allCalories
        // This will trigger the useEffect that updates currentCalories
        setAllCalories(nextAllCalories);

        // 7. Set success message (optional)
        setEstimationResult(`Added ~${estimatedCalories} kcal for ${foodItems.join(', ') || 'identified food'}. Total updated.`);
        console.log("AI log saved successfully. Updated UserData:", updatedUserData);
        // --- END: Correctly Update State and Save with Rewards ---

    } catch (error: any) {
        console.error("Error analyzing image or saving AI log:", error);
        setAnalysisError(error.message || "An unknown error occurred during image analysis.");
    } finally {
        setIsAnalyzing(null); // Reset loading state regardless of success/failure
    }
  }, [address, selectedDate, allCalories, profile]); // Dependencies


  // --- Other Handlers (handleUploadClick, openCamera) ---
  const handleUploadClick = (mealType: 'breakfast' | 'lunch' | 'supper') => {
    setCurrentMealType(mealType); // Set the meal type for context
    // Trigger the hidden file input click
    if (mealType === 'breakfast' && breakfastFileRef.current) {
      breakfastFileRef.current.click();
    } else if (mealType === 'lunch' && lunchFileRef.current) {
      lunchFileRef.current.click();
    } else if (mealType === 'supper' && supperFileRef.current) {
      supperFileRef.current.click();
    }
  };

  const openCamera = (mealType: 'breakfast' | 'lunch' | 'supper') => {
    setCurrentMealType(mealType); // Set the meal type for context
    setIsCameraModalOpen(true); // Open the modal
  };

  // --- Generate Meal Plan ---
  const handleGenerateMealPlan = async () => {
      if (!address) {
          console.error("Cannot generate plan, no address connected.");
          // setPlanGenerationError("Connect your wallet to generate a meal plan.");
          return;
      }
      setIsGeneratingPlan(true);
      // setPlanGenerationError(null);
      console.log("TrackPage: Generating meal plan...");

      try {
          // Check if profile exists and has necessary info
          // Use the profile state variable directly
          if (!profile) {
              throw new Error("User profile not loaded. Cannot generate meal plan.");
          }
          if (!profile.goal || !profile.calorieTarget) {
               throw new Error("Profile goal or calorie target missing. Cannot generate meal plan.");
          }

          const planResponse = await fetch('/api/generate-meal-plan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  profile: profile, // Send loaded profile
                  calorieHistory: allCalories // Send current calorie history
              }),
          });

          if (!planResponse.ok) {
              const errorData = await planResponse.json();
              throw new Error(errorData.error || `API Error: ${planResponse.statusText}`);
          }

          const planData = await planResponse.json();
          console.log("TrackPage: Meal plan received:", planData);

          // 5. Store the new meal plan (using address-specific key)
          const planKey = `${MEAL_PLAN_STORAGE_KEY}-${address}`;
          localStorage.setItem(planKey, JSON.stringify(planData));
          console.log("TrackPage: New meal plan generated and saved to key:", planKey);
          // setPlanGenerationError(null); // Clear error on success

      } catch (error: any) {
          console.error("TrackPage: Failed to generate meal plan:", error);
          // setPlanGenerationError(error.message || "An unknown error occurred.");
      } finally {
          setIsGeneratingPlan(false);
      }
  };

  // --- Calculate Total Calories for Display ---
  const totalCurrentCalories = useMemo(() => {
    const breakfast = Number(currentCalories.breakfast) || 0;
    const lunch = Number(currentCalories.lunch) || 0;
    const supper = Number(currentCalories.supper) || 0;
    return breakfast + lunch + supper;
  }, [currentCalories]);

  // --- Calendar Tile Content ---
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateKey = formatDateKey(date);
      const dayData = allCalories[dateKey];
      const total = dayData ? (Number(dayData.breakfast||0) + Number(dayData.lunch||0) + Number(dayData.supper||0)) : 0;

      if (total > 0) {
        // Basic indicator - adjust styling as needed
        return <p className="text-[var(--app-accent)] text-[9px] font-bold absolute bottom-0.5 left-0 right-0 text-center leading-none">{total}</p>;
      }
    }
    return null;
  };

  // --- Calendar Tile Class Name ---
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateKey = formatDateKey(date);
      if (allCalories[dateKey]) {
        // Add a class if data exists for the day
        return 'has-data';
      }
    }
    return null;
  };

  // --- JSX ---
  const labelClasses = "block text-sm font-medium text-[var(--app-foreground-muted)] mb-1";
  const inputClasses = "block w-full px-3 py-2 bg-[var(--app-background-input)] border border-[var(--app-card-border)] rounded-md shadow-sm placeholder-[var(--app-foreground-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)] focus:border-[var(--app-accent)] sm:text-sm text-[var(--app-foreground)] disabled:opacity-50";

  return (
    <>
      {/* Apply the loading check around the main layout container */}
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        // Restore the single-column, mobile-first layout
        <div className="min-h-screen bg-[var(--app-background)] text-[var(--app-foreground)]">
          <div className="container mx-auto px-4 py-8 max-w-3xl"> {/* Constrain width */}

            {/* Header */}
            <header className="mb-8 flex justify-between items-center">
              <h1 className="text-3xl font-bold text-[var(--app-foreground)]">Track Your Meals</h1>
              {/* Link to Dashboard */}
              <Link href="/dashboard">
                <Button variant="outline" size="sm">Dashboard</Button>
              </Link>
            </header>

            {/* Calendar Section */}
            <section className="mb-8">
              {/* Optional: Add a title like "Select Date" */}
              {/* <h2 className="text-xl font-semibold mb-4">Select Date</h2> */}
              <div className="calorie-calendar-container bg-[var(--app-background-deep)] p-4 rounded-lg border border-[var(--app-card-border)]">
                <Calendar
                  onChange={setSelectedDate} // Use the correct handler
                  value={selectedDate}
                  maxDate={new Date()}
                  tileContent={tileContent}
                  tileClassName={tileClassName}
                  className="w-full bg-transparent border-none" // Make calendar blend in
                />
              </div>
            </section>

            {/* Calorie Logging Card Section */}
            <section className="mb-8">
              <Card title={`Log for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}>
                <div className="space-y-4">
                  {/* Display Total for the day */}
                  <div className="text-center p-3 bg-[var(--app-gray)] rounded-lg mb-4">
                    <p className="text-sm text-[var(--app-foreground-muted)]">Total Calories Logged</p>
                    <p className="text-3xl font-bold text-[var(--app-accent)]">{totalCurrentCalories}</p>
                    {profile?.calorieTarget && (
                      <p className="text-xs text-[var(--app-foreground-muted)] mt-1">
                        Target: {profile.calorieTarget} kcal
                      </p>
                    )}
                  </div>

                  {/* Display Estimation Result/Error */}
                  {isEstimating && ( <div className="text-center p-2 bg-blue-100 text-blue-700 rounded-md text-sm">Estimating calories... <SpinnerIcon /></div> )}
                  {estimationResult && ( <div className="text-center p-2 bg-green-100 text-green-700 rounded-md text-sm">{estimationResult}</div> )}
                  {estimationError && ( <div className="text-center p-2 bg-red-100 text-red-700 rounded-md text-sm">{estimationError}</div> )}

                  {/* Breakfast Input Group */}
                  <div>
                    <label htmlFor="breakfast" className={labelClasses}>🍳 Breakfast Calories</label>
                    <div className="flex items-center space-x-2">
                      <input type="number" id="breakfast" name="breakfast" value={currentCalories.breakfast} onChange={handleCalorieInputChange} className={inputClasses + " flex-grow"} placeholder={isAnalyzing === 'breakfast' ? "Analyzing..." : "e.g., 350"} min="0" disabled={isAnalyzing === 'breakfast'} />
                      <input type="file" ref={breakfastFileRef} onChange={(e) => handleFileChange(e, 'breakfast')} accept="image/*" className="hidden" aria-hidden="true" disabled={!!isAnalyzing} />
                      <Button variant="secondary" size="sm" onClick={() => handleUploadClick('breakfast')} aria-label="Upload breakfast image" disabled={!!isAnalyzing}> {isAnalyzing === 'breakfast' ? <SpinnerIcon /> : <UploadIcon />} </Button>
                      <Button variant="secondary" size="sm" onClick={() => openCamera('breakfast')} aria-label="Scan breakfast" disabled={!!isAnalyzing}> <CameraIcon /> </Button>
                    </div>
                  </div>

                  {/* Lunch Input Group */}
                  <div>
                    <label htmlFor="lunch" className={labelClasses}>🥪 Lunch Calories</label>
                    <div className="flex items-center space-x-2">
                      <input type="number" id="lunch" name="lunch" value={currentCalories.lunch} onChange={handleCalorieInputChange} className={inputClasses + " flex-grow"} placeholder={isAnalyzing === 'lunch' ? "Analyzing..." : "e.g., 600"} min="0" disabled={isAnalyzing === 'lunch'} />
                      <input type="file" ref={lunchFileRef} onChange={(e) => handleFileChange(e, 'lunch')} accept="image/*" className="hidden" aria-hidden="true" disabled={!!isAnalyzing} />
                      <Button variant="secondary" size="sm" onClick={() => handleUploadClick('lunch')} aria-label="Upload lunch image" disabled={!!isAnalyzing}> {isAnalyzing === 'lunch' ? <SpinnerIcon /> : <UploadIcon />} </Button>
                      <Button variant="secondary" size="sm" onClick={() => openCamera('lunch')} aria-label="Scan lunch" disabled={!!isAnalyzing}> <CameraIcon /> </Button>
                    </div>
                  </div>

                  {/* Supper Input Group */}
                  <div>
                    <label htmlFor="supper" className={labelClasses}>🍲 Supper Calories</label>
                    <div className="flex items-center space-x-2">
                      <input type="number" id="supper" name="supper" value={currentCalories.supper} onChange={handleCalorieInputChange} className={inputClasses + " flex-grow"} placeholder={isAnalyzing === 'supper' ? "Analyzing..." : "e.g., 500"} min="0" disabled={isAnalyzing === 'supper'} />
                      <input type="file" ref={supperFileRef} onChange={(e) => handleFileChange(e, 'supper')} accept="image/*" className="hidden" aria-hidden="true" disabled={!!isAnalyzing} />
                      <Button variant="secondary" size="sm" onClick={() => handleUploadClick('supper')} aria-label="Upload supper image" disabled={!!isAnalyzing}> {isAnalyzing === 'supper' ? <SpinnerIcon /> : <UploadIcon />} </Button>
                      <Button variant="secondary" size="sm" onClick={() => openCamera('supper')} aria-label="Scan supper" disabled={!!isAnalyzing}> <CameraIcon /> </Button>
                    </div>
                  </div>

                  {/* Save Button */}
                  <Button onClick={handleSaveChanges} variant="primary" className="w-full flex justify-center items-center" disabled={!!isAnalyzing || isSaving || isGeneratingPlan}>
                    {isSaving ? <SpinnerIcon /> : isAnalyzing || isGeneratingPlan ? "Processing..." : `Save Changes for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </Button>
                </div>
              </Card>
            </section>

            {/* AI Meal Plan Card Section (Optional, can be below logging) */}
            <section className="mb-8">
              <Card title="🤖 AI Meal Suggestions">
                <div className="space-y-4">
                  <p className="text-sm text-[var(--app-foreground-muted)]">
                    AI-powered meal suggestions based on your profile, goals, and past logs will appear here.
                  </p>
                  {/* Button to Generate Plan */}
                  <Button onClick={handleGenerateMealPlan} variant="outline" className="w-full flex justify-center items-center" disabled={isGeneratingPlan || !profile} title={!profile ? "Complete your profile first" : "Generate AI meal suggestions"}>
                    {isGeneratingPlan ? <SpinnerIcon /> : "Generate AI Meal Plan"}
                  </Button>
                  {/* Display generated plan or errors here */}
                </div>
              </Card>
            </section>

          </div> {/* End of container */}

          {/* Add custom calendar styles if needed */}
          <style jsx global>{`
            /* --- START: Force Transparent Background --- */
            .react-calendar {
              background-color: transparent !important; /* Override default background */
              border: none !important; /* Ensure no border from default styles */
            }
            /* --- END: Force Transparent Background --- */

            /* Ensure calendar tiles are visible */
            .react-calendar__tile {
              color: var(--app-foreground);
              background-color: transparent; /* Ensure tiles are transparent by default */
              border-radius: 0.375rem; /* Add some rounding like buttons */
            }
            .react-calendar__tile:hover {
              background-color: var(--app-gray); /* Use theme hover color */
            }
            .react-calendar__month-view__days__day--neighboringMonth {
              color: var(--app-foreground-muted) !important;
              opacity: 0.5;
              background-color: transparent !important; /* Ensure neighboring days are transparent */
            }
            .react-calendar__navigation button {
              color: var(--app-accent);
              font-weight: bold;
              background-color: transparent !important; /* Ensure nav buttons are transparent */
            }
            .react-calendar__navigation button:disabled {
              color: var(--app-foreground-muted);
              opacity: 0.6;
              background-color: transparent !important;
            }
            .react-calendar__tile--active {
              background-color: var(--app-accent) !important;
              color: var(--app-background) !important; /* Use background for text on active */
              font-weight: bold;
            }
             .react-calendar__tile--active:hover {
                 background-color: var(--app-accent-dark) !important; /* Optional: darker hover */
             }
            .react-calendar__tile--now {
              /* Keep background for 'today' or make it transparent too? */
              /* background-color: var(--app-gray) !important; */
              background-color: transparent !important; /* Make 'today' transparent */
              color: var(--app-accent) !important;
              font-weight: bold;
              border: 1px solid var(--app-accent); /* Add border to highlight 'today' */
            }
            .react-calendar__tile.has-data {
               position: relative;
               /* Optional: Add a dot or underline */
               /* Example dot: */
               &::after {
                 content: '';
                 position: absolute;
                 bottom: 5px;
                 left: 50%;
                 transform: translateX(-50%);
                 width: 5px;
                 height: 5px;
                 border-radius: 50%;
                 background-color: var(--app-accent);
               }
            }
            /* Add more overrides as needed */

            /* --- START: Style Disabled (Future) Tiles --- */
            .react-calendar__tile--disabled {
              background-color: transparent !important; /* Ensure background is transparent */
              color: var(--app-foreground-muted) !important; /* Use muted color for text */
              opacity: 0.6; /* Optional: Slightly fade them out */
              pointer-events: none; /* Ensure they are not interactive */
            }
            /* Optional: Remove hover effect specifically for disabled tiles if needed */
            .react-calendar__tile--disabled:hover {
                background-color: transparent !important;
            }
            /* --- END: Style Disabled (Future) Tiles --- */
          `}</style>
        </div>
      )} {/* End of the conditional rendering */}

      {/* Render Camera Modal (outside the conditional rendering) */}
      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCaptureSuccess={handleCaptureSuccess}
        mealType={currentMealType}
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

// --- Loading Spinner Component ---
function LoadingSpinner() {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-[var(--app-accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-lg text-[var(--app-foreground-muted)]">Loading Data...</span>
        </div>
    );
} 