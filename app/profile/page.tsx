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
} from "@coinbase/onchainkit/transaction";
import { useState, type FormEvent, useEffect, useCallback, useMemo } from "react"; // Import more hooks
import {QRCodeCanvas, QRCodeSVG} from "qrcode.react"; // Import QRCode Code component
import { parseEther } from "viem"; // Helper to convert ETH string to wei BigInt

// Define types for profile data
type HealthGoal = "weight_loss" | "weight_gain" | "maintenance";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

interface HealthProfile {
  age: number | "";
  gender: string;
  height: number | ""; // Consider units (cm/inches)
  weight: number | ""; // Consider units (kg/lbs)
  goal: HealthGoal;
  activityLevel: ActivityLevel;
  restrictions: string;
  calorieTarget: number | "";
}

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
  userAddress: `0x${string}`; // Needed for Transaction component if sending from user
}

function SendModal({ isOpen, onClose, userAddress }: SendModalProps) {
    const [recipientAddress, setRecipientAddress] = useState<`0x${string}` | "">("");
    const [sendAmount, setSendAmount] = useState<string>(""); // Store as string for input
    const [error, setError] = useState<string | null>(null);

    // Construct transaction calls based on input
    const calls = useMemo(() => {
        setError(null); // Reset error on input change
        if (!recipientAddress || !sendAmount) return [];
        try {
            const amountInWei = parseEther(sendAmount); // Convert ETH string to wei BigInt
            if (amountInWei <= 0n) {
                setError("Amount must be positive.");
                return [];
            }
            // Basic address validation (more robust validation recommended)
            if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
                 setError("Invalid recipient address format.");
                 return [];
            }

            return [{
                to: recipientAddress,
                value: amountInWei,
                data: "0x" as `0x${string}`, // No data for basic ETH transfer
            }];
        } catch (e) {
            console.error("Error parsing amount:", e);
            setError("Invalid amount entered.");
            return [];
        }
    }, [recipientAddress, sendAmount]);

    const handleSuccess = useCallback((response: TransactionResponse) => {
        console.log("Transaction successful:", response);
        setRecipientAddress("");
        setSendAmount("");
        setError(null);
        onClose(); // Close modal on success
        // Optionally show a success notification
    }, [onClose]);

    const handleError = useCallback((txError: TransactionError) => {
        console.error("Transaction failed:", txError);
        setError(txError.message || "Transaction failed. Please try again.");
        // Don't close modal on error, let user see the message
    }, []);

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-[var(--app-card-bg)] border border-[var(--app-card-border)] rounded-md text-[var(--app-foreground)] placeholder-[var(--app-foreground-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)]";
    const labelClasses = "block text-sm font-medium text-[var(--app-foreground-muted)]";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send Funds">
        <Transaction
            calls={calls}
            address={userAddress}
            onSuccess={handleSuccess}
            onError={handleError}
        >
            <div className="space-y-4">
                <div>
                    <label htmlFor="recipientAddress" className={labelClasses}>Recipient Address</label>
                    <input
                        type="text"
                        id="recipientAddress"
                        name="recipientAddress"
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value as `0x${string}`)}
                        className={inputClasses}
                        placeholder="0x..."
                        required
                    />
                </div>
                <div>
                    <label htmlFor="sendAmount" className={labelClasses}>Amount (ETH)</label>
                    <input
                        type="number" // Use number for better mobile keyboards, but handle as string
                        id="sendAmount"
                        name="sendAmount"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        className={inputClasses}
                        placeholder="0.0"
                        required
                        step="any" // Allow decimals
                        min="0"
                    />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <TransactionStatus className="mt-3">
                    <TransactionStatusAction>
                        {/* Customizing the button text/state if needed */}
                        <TransactionButton className="w-full">
                            {/* Default text is usually fine, or customize */}
                            Send Transaction
                        </TransactionButton>
                    </TransactionStatusAction>
                    <TransactionStatusLabel />
                </TransactionStatus>

                <TransactionToast className="absolute bottom-4 right-4 mb-4 mr-4">
                    <TransactionToastIcon />
                    <TransactionToastLabel />
                    <TransactionToastAction />
                </TransactionToast>

                 <Button onClick={onClose} variant="outline" className="w-full mt-2">
                    Cancel
                </Button>
            </div>
      </Transaction>
    </Modal>
  );
}

// --- Profile Page Component ---

export default function ProfilePage() {
  const { address } = useAccount();
  const [profile, setProfile] = useState<HealthProfile>({
    age: "",
    gender: "",
    height: "",
    weight: "",
    goal: "maintenance",
    activityLevel: "moderate",
    restrictions: "",
    calorieTarget: "",
  });
  const [isProfileCreated, setIsProfileCreated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false); // State for Receive modal
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);     // State for Send modal

  // Load profile from Local Storage on component mount
  useEffect(() => {
    setIsLoading(true);
    try {
      const storedProfile = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile) as HealthProfile;
        // Basic validation (can be more robust)
        if (parsedProfile && typeof parsedProfile === 'object') {
            setProfile(parsedProfile);
            setIsProfileCreated(true);
        } else {
            console.warn("Invalid profile data found in local storage.");
            localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear invalid data
        }
      }
    } catch (error) {
      console.error("Failed to load profile from local storage:", error);
      // Handle potential errors like disabled local storage or parsing issues
    } finally {
        setIsLoading(false); // Finish loading
    }
  }, []); // Empty dependency array ensures this runs only once on mount

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log("Health Profile Submitted:", profile);
    try {
      // Save to Local Storage
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
      setIsProfileCreated(true); // Mark profile as created for display purposes
      // You might want to show a success message here
    } catch (error) {
      console.error("Failed to save profile to local storage:", error);
      // Handle potential errors like storage limit exceeded
      // Show an error message to the user
    }
  };

  // Basic input styling (you can enhance this or create dedicated components)
  const inputClasses = "mt-1 block w-full px-3 py-2 bg-[var(--app-card-bg)] border border-[var(--app-card-border)] rounded-md text-[var(--app-foreground)] placeholder-[var(--app-foreground-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)]";
  const labelClasses = "block text-sm font-medium text-[var(--app-foreground-muted)]";

  // Display loading indicator while checking local storage
  if (isLoading) {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <p>Loading Profile...</p> {/* Or a spinner component */}
        </div>
    );
  }

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
                          <p className="text-sm font-semibold text-[var(--app-foreground)] capitalize">{profile.goal.replace("_", " ") || "N/A"}</p>
                        </div>
                      </div>

                      {/* Activity Level */}
                      <div className="flex items-center space-x-2 p-2 bg-[var(--app-gray)] rounded-lg">
                         <span className="text-xl" role="img" aria-label="Fire">🔥</span>
                        <div>
                          <p className="text-xs font-medium text-[var(--app-foreground-muted)]">Activity</p>
                          <p className="text-sm font-semibold text-[var(--app-foreground)] capitalize">{profile.activityLevel || "N/A"}</p>
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
                      Save Profile
                    </Button>
                  </form>
                )}
              </Card>
            )}
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