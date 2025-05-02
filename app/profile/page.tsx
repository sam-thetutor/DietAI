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
import {
    Transaction,
    TransactionButton,
    TransactionStatus,
    TransactionStatusAction,
    TransactionStatusLabel,
    TransactionToast,
    TransactionToastIcon,
    TransactionToastLabel,
    TransactionToastAction,
    type TransactionError,
    type TransactionResponse,
    type APIError,
} from "@coinbase/onchainkit/transaction";
import { useState, type FormEvent, useEffect, useMemo } from "react"; // Import more hooks
import {QRCodeSVG} from "qrcode.react"; // Import QRCode Code component
import { parseEther } from "viem"; // Helper to convert ETH string to wei BigInt

// --- Reward System Imports ---
import { getUserData, saveUserData, UserData } from '@/src/lib/userData'; // Adjust path
import { checkAndAwardMilestones } from '@/src/lib/rewards'; // Adjust path
import { HealthProfile, AllCalories } from "@/src/lib/types"; // Assuming types are defined here
import { MILESTONES, Milestone } from '@/src/config/milestones'; // Import MILESTONES and Milestone type
// --- End Reward System Imports ---


// // Define types for profile data
// type HealthGoal = "weight_loss" | "weight_gain" | "maintenance";
// type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";


const LOCAL_STORAGE_KEY = "caloai-healthProfile"; // Define a key for local storage

// --- Modal Components (can be moved to separate files later) ---

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}

function Modal({ isOpen, onClose, children, title }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-[var(--app-background)] rounded-xl shadow-xl w-full max-w-md m-4 border border-[var(--app-card-border)]">
        <div className="flex justify-between items-center p-4 border-b border-[var(--app-card-border)]">
          <h3 className="text-lg font-semibold text-[var(--app-foreground)]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[var(--app-foreground-muted)] hover:text-[var(--app-foreground)] text-2xl leading-none"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: `0x${string}`;
}

function ReceiveModal({ isOpen, onClose, address }: ReceiveModalProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
        }).catch(err => {
            console.error('Failed to copy address: ', err);
            // Optionally show an error message to the user
        });
    };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Receive Funds">
      <div className="flex flex-col items-center space-y-4">
        <div className="p-2 bg-white rounded-lg"> {/* QR Code Background */}
          <QRCodeSVG value={address} size={192} level="H" />
        </div>
        <p className="text-sm text-[var(--app-foreground-muted)] break-all text-center px-4">
          {address}
        </p>
        <Button onClick={handleCopy} variant="secondary" className="w-full">
          {copied ? "Copied!" : "Copy Address"}
        </Button>
         <Button onClick={onClose} variant="outline" className="w-full mt-2">
          Close
        </Button>
      </div>
    </Modal>
  );
}

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: `0x${string}`; // Keep userAddress prop for display/logic if needed elsewhere
}

function SendModal({ isOpen, onClose, userAddress }: SendModalProps) {
  const [recipient, setRecipient] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setRecipient("");
      setSendAmount("");
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  const handleSuccess = (response: TransactionResponse) => {
    console.log("Transaction successful:", response);
    const txHash = response.receipt?.transactionHash || 'N/A';
    setSuccessMessage(`Transaction successful! Hash: ${txHash.substring(0, 10)}...`);
    setError(null);
    // Optionally close modal after a delay or keep it open to show success
    // setTimeout(onClose, 3000);
  };

  const handleError = (txError: APIError) => {
    console.error("Transaction error:", txError);
    const message = txError.message || "Transaction failed.";
    setError(message);
    setSuccessMessage(null);
  };

  // Prepare transaction calls (memoized)
  const calls = useMemo(() => {
    setError(null); // Clear error when inputs change
    setSuccessMessage(null); // Clear success when inputs change
    if (!recipient || !sendAmount) {
      return []; // No calls if inputs are missing
    }
    // Basic validation for recipient address
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      setError("Invalid recipient address format.");
      return [];
    }
    try {
      const amountInWei = parseEther(sendAmount); // Convert ETH string to wei BigInt
      if (amountInWei <= 0n) {
        setError("Amount must be positive.");
        return [];
      }
      // Prepare the transaction call object
      return [{
        to: recipient as `0x${string}`, // Type assertion after validation
        value: amountInWei,
        data: '0x' as `0x${string}`, // For simple ETH transfer, data is '0x'
      }];
    } catch (e) {
      console.error("Error parsing amount:", e);
      setError("Invalid amount entered.");
      return [];
    }
  }, [recipient, sendAmount]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send ETH">
      <div className="space-y-4">
        <div>
          <label htmlFor="recipient" className="block text-sm font-medium text-[var(--app-foreground-muted)] mb-1">Recipient Address</label>
          <input
            type="text"
            id="recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 rounded-md border border-[var(--app-card-border)] bg-[var(--app-gray)] text-[var(--app-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)]"
            required
          />
        </div>
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-[var(--app-foreground-muted)] mb-1">Amount (ETH)</label>
          <input
            type="number" // Use number for easier input, but parse carefully
            id="amount"
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
            placeholder="0.01"
            className="w-full px-3 py-2 rounded-md border border-[var(--app-card-border)] bg-[var(--app-gray)] text-[var(--app-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)]"
            required
            step="any" // Allow decimals
            min="0"
          />
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        {successMessage && <p className="text-sm text-green-500 text-center">{successMessage}</p>}

        {/* Transaction Component Integration */}
        <Transaction
            calls={calls}
            // Remove the address prop - it uses the connected wallet context
            // address={userAddress}
            onSuccess={handleSuccess}
            onError={handleError}
        >
          <TransactionStatus>
            <TransactionStatusAction className="w-full">
              <TransactionButton className="w-full" disabled={calls.length === 0 || !!error}>
                {/* Default text is usually fine, or customize */}
                Send Transaction
              </TransactionButton>
            </TransactionStatusAction>
            <TransactionStatusLabel className="mt-2 text-center text-xs text-[var(--app-foreground-muted)]" />
          </TransactionStatus>
        </Transaction>

        <TransactionToast>
          <TransactionToastIcon />
          <TransactionToastLabel />
          <TransactionToastAction />
        </TransactionToast>

        <Button onClick={onClose} variant="outline" className="w-full mt-2">
          Cancel
        </Button>
      </div>
    </Modal>
  );
}


export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [profile, setProfile] = useState<HealthProfile>({
    age: "",
    gender: "",
    height: "",
    weight: "",
    goal: "maintenance",
    activityLevel: "sedentary",
    restrictions: "",
    calorieTarget: "",
  });
  const [isProfileCreated, setIsProfileCreated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false); // State for Receive modal
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);     // State for Send modal
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Add State for User Reward Data ---
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);

  // --- Load Profile & User Reward Data ---
  useEffect(() => {
    setIsLoading(true);
    setIsLoadingUserData(true); // Start loading user data
    setUserData(null); // Reset user data on address change
    if (address) {
      try {
        // Load Profile
        const storedProfile = localStorage.getItem(`${LOCAL_STORAGE_KEY}-${address}`);
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          setProfile(parsed);
          setIsProfileCreated(true);
        } else {
          setProfile({
            age: "", gender: "", height: "", weight: "",
            goal: "maintenance", activityLevel: "sedentary", restrictions: "",
            calorieTarget: "",
          });
          setIsProfileCreated(false);
        }

        // Load User Reward Data
        const fetchedUserData = getUserData(address);
        setUserData(fetchedUserData);
        console.log("Loaded user reward data:", fetchedUserData);

      } catch (error) {
        console.error("Failed to load profile or user data:", error);
        setProfile({
          age: "", gender: "", height: "", weight: "",
          goal: "maintenance", activityLevel: "sedentary", restrictions: "",
          calorieTarget: "",
        });
        setIsProfileCreated(false);
        setUserData(getUserData(address)); // Still try to get default user data on error
      } finally {
        setIsLoading(false);
        setIsLoadingUserData(false); // Finish loading user data
      }
    } else {
      // No address connected
      setIsLoading(false);
      setIsProfileCreated(false);
      setProfile({
        age: "", gender: "", height: "", weight: "",
        goal: "maintenance", activityLevel: "sedentary", restrictions: "",
        calorieTarget: "",
      });
      setUserData(null);
    }
  }, [address]); // Reload profile and user data if address changes

  // --- Calculate Unachieved Milestones ---
  const unachievedMilestones = useMemo(() => {
    if (!userData) return [];
    const achievedIds = new Set(userData.achievedMilestones);
    return MILESTONES.filter(milestone => !achievedIds.has(milestone.id));
  }, [userData]); // Recalculate only when userData changes

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setProfile((prevProfile) => ({
      ...prevProfile,
      [name]: name === "age" || name === "height" || name === "weight" || name === "calorieTarget"
        ? (value === "" ? "" : Number(value)) // Handle number conversion, allow empty string
        : value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!address || !profile) return; // Ensure address and profile data exist

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // 1. Save the profile data (assuming this function exists and works)
      // save(address, profile); // Example function call

      // For local storage:
      localStorage.setItem(`${LOCAL_STORAGE_KEY}-${address}`, JSON.stringify(profile));
      console.log("Profile saved to local storage:", profile);


      // 2. Check for milestones related to profile completion
      if (userData) { // Ensure userData is loaded
          console.log("Checking profile milestones after save...");
          // Destructure according to the new return type
          const { updatedUserData: finalUserData, newlyAchieved: newlyAchievedIds } = checkAndAwardMilestones(
              userData,
              profile, // Pass profile data
              null     // No meal context needed here
          );

          // 3. If milestones were awarded, save the updated user data
          if (newlyAchievedIds.length > 0) { // Check if the array has items
              console.log("Profile milestones awarded, saving updated user data...");
              await saveUserData(address, finalUserData); // Save to backend/storage
              setUserData(finalUserData); // Update local state to reflect changes immediately
              console.log("User data updated with new points/milestones.");
              // Optionally show a success message about points earned
              setSuccessMessage("Profile saved successfully! Points awarded for milestones.");
              // Optionally trigger notifications
              newlyAchievedIds.forEach(id => {
                  const milestone = MILESTONES.find(m => m.id === id);
                  if (milestone) {
                      console.log(`UI NOTIFICATION: Milestone Achieved - ${milestone.name} (+${milestone.points} Points)`);
                      // alert(`Milestone Achieved: ${milestone.name} (+${milestone.points} Points)`); // Replace with toast
                  }
              });
          } else {
               setSuccessMessage("Profile saved successfully."); // No new points awarded
          }
      } else {
           setSuccessMessage("Profile saved successfully. (Could not check milestones - user data not loaded)");
      }


    } catch (err) {
      console.error("Error saving profile:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Basic input styling (you can enhance this or create dedicated components)
  const inputClasses = "mt-1 block w-full px-3 py-2 bg-[var(--app-card-bg)] border border-[var(--app-card-border)] rounded-md text-[var(--app-foreground)] placeholder-[var(--app-foreground-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)] disabled:opacity-50";
  const labelClasses = "block text-sm font-medium text-[var(--app-foreground-muted)] mb-1";

  // Display loading indicator while checking local storage
  if (isLoading) {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <p>Loading Profile...</p> {/* Or a spinner component */}
        </div>
    );
  }

  // --- Get Milestone Details ---
  const getMilestoneDetails = (id: string) => {
      return MILESTONES.find(m => m.id === id);
  };

  return (
    <> {/* Use Fragment to allow modals outside the main layout flow */}
      <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
        <div className="w-full max-w-md mx-auto px-4 py-3">
          <header className="flex justify-between items-center mb-6 h-11">
            <h1 className="text-xl font-semibold">Profile</h1>
            <Link href="/">
              <Button variant="outline" size="sm">
                Back Home
              </Button>
            </Link>
          </header>

          <main className="flex-1 space-y-6">
            {/* --- Updated Wallet Info Card --- */}
            <Card title="Wallet Information">
              {address ? (
                <div className="space-y-4">
                  {/* Identity Info */}
                  <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                    <div className="flex items-center space-x-3">
                        <Avatar className="w-12 h-12" /> {/* Slightly smaller avatar */}
                        <div className="flex-grow">
                            <Name className="text-base font-medium" />
                            <Address className="text-xs" /> {/* Smaller address */}
                        </div>
                    </div>
                     <div className="mt-2 pl-[58px]"> {/* Align balance under name/address */}
                        <EthBalance className="text-sm font-semibold" />
                    </div>
                  </Identity>

                  {/* Action Buttons */}
                  <div className="flex gap-3 px-4 pb-2">
                    <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => setIsSendModalOpen(true)}
                    >
                        Send
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => setIsReceiveModalOpen(true)}
                    >
                        Receive
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-[var(--app-foreground-muted)] px-5 py-3">
                  Connect your wallet to manage your profile and funds.
                </p>
              )}
            </Card>
            {/* --- End Updated Wallet Info Card --- */}

            {/* Health Profile Section */}
            {address && ( // Only show profile section if wallet is connected
              <Card title={isProfileCreated ? "Your Health Profile" : "Create Health Profile"}>
                {isProfileCreated ? (
                  // --- START: Updated Display Section ---
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                      {/* Age */}
                      <div className="flex items-center space-x-2 p-2 bg-[var(--app-gray)] rounded-lg">
                        <span className="text-xl" role="img" aria-label="Birthday cake">🎂</span>
                        <div>
                          <p className="text-xs font-medium text-[var(--app-foreground-muted)]">Age</p>
                          <p className="text-sm font-semibold text-[var(--app-foreground)]">{profile.age || "N/A"}</p>
                        </div>
                      </div>

                      {/* Gender */}
                      <div className="flex items-center space-x-2 p-2 bg-[var(--app-gray)] rounded-lg">
                        <span className="text-xl" role="img" aria-label="Person silhouette">👤</span>
                        <div>
                          <p className="text-xs font-medium text-[var(--app-foreground-muted)]">Gender</p>
                          <p className="text-sm font-semibold text-[var(--app-foreground)]">{profile.gender || "N/A"}</p>
                        </div>
                      </div>

                      {/* Height */}
                      <div className="flex items-center space-x-2 p-2 bg-[var(--app-gray)] rounded-lg">
                         <span className="text-xl" role="img" aria-label="Ruler">📏</span>
                        <div>
                          <p className="text-xs font-medium text-[var(--app-foreground-muted)]">Height</p>
                          <p className="text-sm font-semibold text-[var(--app-foreground)]">{profile.height ? `${profile.height} cm` : "N/A"}</p>
                        </div>
                      </div>

                      {/* Weight */}
                      <div className="flex items-center space-x-2 p-2 bg-[var(--app-gray)] rounded-lg">
                         <span className="text-xl" role="img" aria-label="Scales">⚖️</span>
                        <div>
                          <p className="text-xs font-medium text-[var(--app-foreground-muted)]">Weight</p>
                          <p className="text-sm font-semibold text-[var(--app-foreground)]">{profile.weight ? `${profile.weight} kg` : "N/A"}</p>
                        </div>
                      </div>

                       {/* Goal */}
                      <div className="flex items-center space-x-2 p-2 bg-[var(--app-gray)] rounded-lg">
                         <span className="text-xl" role="img" aria-label="Target">🎯</span>
                        <div>
                          <p className="text-xs font-medium text-[var(--app-foreground-muted)]">Goal</p>
                          <p className="text-sm font-semibold text-[var(--app-foreground)] capitalize">
                            {profile.goal?.replace('_', ' ') ?? 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Activity Level */}
                      <div className="flex items-center space-x-2 p-2 bg-[var(--app-gray)] rounded-lg">
                         <span className="text-xl" role="img" aria-label="Fire">🔥</span>
                        <div>
                          <p className="text-xs font-medium text-[var(--app-foreground-muted)]">Activity</p>
                          <p className="text-sm font-semibold text-[var(--app-foreground)] capitalize">
                            {profile.activityLevel?.replace('_', ' ') ?? 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Calorie Target (Full Width) */}
                     <div className="flex items-center space-x-2 p-3 bg-[var(--app-gray)] rounded-lg">
                         <span className="text-xl" role="img" aria-label="Plate with cutlery">🍽️</span>
                        <div>
                          <p className="text-xs font-medium text-[var(--app-foreground-muted)]">Daily Calorie Target</p>
                          <p className="text-sm font-semibold text-[var(--app-foreground)]">{profile.calorieTarget ? `${profile.calorieTarget} kcal` : "N/A"}</p>
                        </div>
                      </div>

                    {/* Restrictions (Full Width) */}
                    <div className="p-3 bg-[var(--app-gray)] rounded-lg">
                       <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xl" role="img" aria-label="No entry sign">🚫</span>
                          <p className="text-xs font-medium text-[var(--app-foreground-muted)]">Restrictions/Preferences</p>
                       </div>
                       <p className="text-sm text-[var(--app-foreground)] pl-1">{profile.restrictions || "None specified"}</p>
                    </div>

                    {/* Edit Button */}
                    <div className="pt-2">
                       <Button variant="secondary" size="sm" onClick={() => setIsProfileCreated(false)} className="w-full">
                          Edit Profile
                       </Button>
                    </div>
                  </div>
                  // --- END: Updated Display Section ---
                ) : (
                  // Profile Creation Form
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="age" className={labelClasses}>Age</label>
                        <input type="number" id="age" name="age" value={profile.age} onChange={handleInputChange} className={inputClasses} required min="0" />
                      </div>
                      <div>
                        <label htmlFor="gender" className={labelClasses}>Gender</label>
                        <input type="text" id="gender" name="gender" value={profile.gender} onChange={handleInputChange} className={inputClasses} />
                      </div>
                      <div>
                        <label htmlFor="height" className={labelClasses}>Height (cm)</label>
                        <input type="number" id="height" name="height" value={profile.height} onChange={handleInputChange} className={inputClasses} required min="0" />
                      </div>
                      <div>
                        <label htmlFor="weight" className={labelClasses}>Weight (kg)</label>
                        <input type="number" id="weight" name="weight" value={profile.weight} onChange={handleInputChange} className={inputClasses} required min="0" />
                      </div>
                    </div>

                    {/* Goals and Activity */}
                    <div>
                      <label htmlFor="goal" className={labelClasses}>Health Goal</label>
                      <select id="goal" name="goal" value={profile.goal} onChange={handleInputChange} className={inputClasses} required>
                        <option value="maintenance">Maintenance</option>
                        <option value="weight_loss">Weight Loss</option>
                        <option value="weight_gain">Weight Gain</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="activityLevel" className={labelClasses}>Activity Level</label>
                      <select id="activityLevel" name="activityLevel" value={profile.activityLevel} onChange={handleInputChange} className={inputClasses} required>
                        <option value="sedentary">Sedentary (little/no exercise)</option>
                        <option value="light">Light (exercise 1-3 days/week)</option>
                        <option value="moderate">Moderate (exercise 3-5 days/week)</option>
                        <option value="active">Active (exercise 6-7 days/week)</option>
                        <option value="very_active">Very Active (hard exercise/physical job)</option>
                      </select>
                    </div>

                    {/* Restrictions and Targets */}
                    <div>
                      <label htmlFor="restrictions" className={labelClasses}>Dietary Restrictions/Preferences</label>
                      <textarea id="restrictions" name="restrictions" value={profile.restrictions} onChange={handleInputChange} className={inputClasses} rows={3} placeholder="e.g., Vegetarian, Gluten-Free, Allergies..."></textarea>
                    </div>
                    <div>
                      <label htmlFor="calorieTarget" className={labelClasses}>Daily Calorie Target (kcal)</label>
                      <input type="number" id="calorieTarget" name="calorieTarget" value={profile.calorieTarget} onChange={handleInputChange} className={inputClasses} required min="0" />
                    </div>

                    {/* Macro/Micro Nutrient Goals - Simple Text Area for now */}
                    {/* <div>
                      <label htmlFor="macroGoals" className={labelClasses}>Macro/Micro Nutrient Goals</label>
                      <textarea id="macroGoals" name="macroGoals" value={profile.macroGoals} onChange={handleInputChange} className={inputClasses} rows={2} placeholder="e.g., Protein: 150g, Carbs: 200g, Fat: 70g or specific vitamin targets..."></textarea>
                    </div> */}

                    <Button type="submit" variant="primary" className="w-full">
                      {isProfileCreated ? "Update Profile" : "Save Profile"}
                    </Button>
                  </form>
                )}
              </Card>
            )}

            {/* --- NEW: Rewards & Milestones Card --- */}
            {address && userData && (
              <Card title="🏆 Rewards & Milestones" className="md:col-span-1">
                {isLoadingUserData ? (
                   <p className="text-center text-sm text-[var(--app-foreground-muted)]">Loading rewards...</p>
                ) : (
                  <div className="space-y-4">
                    {/* Display Points */}
                    <div className="text-center p-3 bg-[var(--app-gray)] rounded-lg">
                      <p className="text-sm font-medium text-[var(--app-foreground-muted)]">Your Points</p>
                      {/* Access points from userData state */}
                      <p className="text-4xl font-bold text-[var(--app-accent)]">{userData.points ?? 0}</p>
                    </div>

                    {/* Display Current Streak */}
                    <div className="text-sm">
                      <p><span className="font-semibold">Current Streak:</span> {userData.currentStreak} day{userData.currentStreak !== 1 ? 's' : ''} 🔥</p>
                      <p><span className="font-semibold">Last Logged:</span> {userData.lastTrackedDate ? new Date(userData.lastTrackedDate + 'T00:00:00').toLocaleDateString() : 'Never'}</p>
                    </div>

                    {/* Display Achieved Milestones */}
                    <div>
                      <h4 className="font-semibold mb-2 border-b border-[var(--app-card-border)] pb-1">Achieved Milestones:</h4>
                      {userData.achievedMilestones.length > 0 ? (
                        <ul className="space-y-1 list-disc list-inside text-sm">
                          {userData.achievedMilestones.map(msId => {
                             const details = getMilestoneDetails(msId);
                             return details ? (
                               <li key={msId} title={details.description}>{details.name}</li>
                             ) : (
                               <li key={msId}>{msId} (details not found)</li>
                             );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-[var(--app-foreground-muted)]">No milestones achieved yet. Keep tracking!</p>
                      )}
                    </div>

                    {/* Display Totals */}
                     <div className="text-sm border-t border-[var(--app-card-border)] pt-3 mt-3">
                         <p><span className="font-semibold">Total Meals Logged:</span> {userData.totalMealsLogged}</p>
                         <p><span className="font-semibold">Total AI Scans Used:</span> {userData.totalAiScans}</p>
                     </div>

                  </div>
                )}
              </Card>
            )}
            {/* --- END: Rewards & Milestones Card --- */}

          </main>
        </div>
      </div>

      {/* Render Modals (conditionally based on state) */}
      {address && (
          <>
            <ReceiveModal
                isOpen={isReceiveModalOpen}
                onClose={() => setIsReceiveModalOpen(false)}
                address={address}
            />
            <SendModal
                isOpen={isSendModalOpen}
                onClose={() => setIsSendModalOpen(false)}
                userAddress={address}
            />
          </>
      )}
    </>
  );
} 