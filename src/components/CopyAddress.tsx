"use client";

import { useState } from "react";
import { addressElementId } from "@/lib/dom-ids";

/**
 * Copies the pickup address to the clipboard.
 *
 * This button exists because there is deliberately no "Get directions" link
 * anywhere in MealBridge — no maps, no places API, nothing that would hand a
 * third party a record of who is going where for food. Copying the address
 * lets someone paste it into whatever they already use, on their own terms.
 */
export function CopyAddress({
  address,
  label,
  copiedLabel,
}: {
  address: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // Clipboard access can be refused (insecure context, denied permission).
      // Selecting the text is the honest fallback, and the address is already
      // on screen as plain text, so nothing is lost.
      const range = document.createRange();
      const node = document.getElementById(addressElementId(address));
      if (node) {
        range.selectNodeContents(node);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  }

  return (
    <button type="button" onClick={copy} className="btn btn-quiet text-sm" aria-live="polite">
      {copied ? (
        <>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8.5L6.5 12L13 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {copiedLabel}
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="5.75" y="5.75" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10.25 3.75A1.5 1.5 0 0 0 8.75 2.25h-5a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 1.5 1.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

