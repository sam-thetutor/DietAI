"use client";

import {
  useMiniKit,
  useAddFrame,
} from "@coinbase/onchainkit/minikit";
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import Image from "next/image";
import { Button, Card, Icon } from "./components/DemoComponents";

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);

  const addFrame = useAddFrame();
  const { address } = useAccount();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  }, [addFrame]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddFrame}
          className="text-[var(--app-accent)] p-4"
          icon={<Icon name="plus" size="sm" />}
        >
          Save Frame
        </Button>
      );
    }

    if (frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-[#0052FF] animate-fade-out">
          <Icon name="check" size="sm" className="text-[#0052FF]" />
          <span>Saved</span>
        </div>
      );
    }

    return null;
  }, [context, frameAdded, handleAddFrame]);

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <header className="flex justify-between items-center mb-3 h-11">
          <div>
            <div className="flex items-center space-x-2">
              <Wallet className="z-10">
                <ConnectWallet>
                  <Name className="text-inherit" />
                </ConnectWallet>
                <WalletDropdown>
                  <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                    <Avatar />
                    <Name />
                    <Address />
                    <EthBalance />
                  </Identity>
                  <WalletDropdownDisconnect />
                </WalletDropdown>
              </Wallet>
            </div>
          </div>
          <div>{saveFrameButton}</div>
        </header>



        <main className="flex-1 space-y-6  rounded-lg p-4 min-h-[500px]">

          {address && (
            <Card title="">
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/dashboard" passHref legacyBehavior>
                  <Button as="a" variant="primary" className="w-full sm:w-auto">
                    Dashboard
                  </Button>
                </Link>
                <Link href="/track" passHref legacyBehavior>
                  <Button as="a" variant="outline" className="w-full sm:w-auto">
                    Track
                  </Button>
                </Link>
                <Link href="/profile" passHref legacyBehavior>
                  <Button as="a" variant="secondary" className="w-full sm:w-auto">
                    Profile
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-[var(--app-foreground)]">Welcome to CaloAI</h1>
              <p className="text-xl text-[var(--app-foreground-muted)]">Your AI-Powered Calorie Tracking Assistant</p>
            </div>

            <div className="flex justify-center">
              <Image
                src="/logo.png"
                alt="CaloAI Logo"
                width={192}
                height={192}
                className="rounded-lg shadow-lg"
                priority
              />
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              <p className="text-[var(--app-foreground-muted)]">
                Track your calories effortlessly with the power of AI. Simply take a photo of your meal and let CaloAI do the rest.
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="primary" size="lg">Get Started</Button>
                <Button variant="outline" size="lg">Learn More</Button>
              </div>
            </div>
          </div>

          {/* <TodoList /> */}
          {/* <TransactionCard /> */}
        </main>

        {/* <footer className="mt-2 pt-4 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--ock-text-foreground-muted)] text-xs"
            onClick={() => openUrl("https://base.org/builders/minikit")}
          >
            Built on Base with MiniKit
          </Button>
        </footer> */}
      </div>
    </div>
  );
}
