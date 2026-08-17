"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { telexInsert, telexUndoTone } from "../lib/telex";

/**
 * Vietnamese/English keyboard-mode context.
 *
 * While Vietnamese mode is on, every letter typed into any input/textarea in
 * the app is run through the Telex engine (see app/lib/telex.js): vowel pairs
 * compose (aa→â, uw→ư, uo→ươ…) and the tone keys s/f/r/x/j mark the correct
 * main vowel — "nuoc" + s → "nước", "ban" + f → "bàn". Pressing the same tone
 * key toggles the tone off, and Backspace undoes the tone before deleting.
 *
 * English mode passes every key through untouched. The chosen mode is
 * remembered in localStorage and exposed to the UI via useKeyboardMode()
 * (the toggle button lives in the header next to the language toggle).
 */

const KeyboardModeContext = createContext();

const LETTER_RE = /^[a-z]$/i;
const TONE_KEYS = new Set(["s", "f", "r", "x", "j"]);

function isEditable(el) {
  if (!el || typeof el.tagName !== "string") return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    const type = (el.type || "text").toLowerCase();
    return ["text", "search", "url", "email", "tel"].includes(type);
  }
  return false;
}

/** Set an input's value in a way React's onChange actually observes. */
function setValueReact(el, value) {
  const proto =
    el.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function caretOf(el) {
  return {
    start: el.selectionStart ?? el.value.length,
    end: el.selectionEnd ?? el.value.length,
  };
}

export function KeyboardModeProvider({ children }) {
  const [mode, setMode] = useState("en");
  // The last tone key applied to an element, so Backspace can undo it first.
  const lastToneRef = useRef(null);
  const didMountRef = useRef(false);

  // Restore the saved mode once (deferred so it can't trigger a hydration
  // mismatch: the server always renders the default English mode first).
  useEffect(() => {
    const id = window.setTimeout(() => {
      const saved = window.localStorage.getItem("keyboard-mode");
      if (saved === "vi" || saved === "en") setMode(saved);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Persist the mode, but never on the initial mount — that would clobber the
  // saved mode with the default "en" before the restore effect above reads it.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    window.localStorage.setItem("keyboard-mode", mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "vi") return;

    function onKeyDown(event) {
      if (event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const el = event.target;
      if (!isEditable(el)) return;

      const key = event.key;

      // Backspace: if the last keystroke was a tone key on this element and
      // the caret is still right after it, undo the tone instead of deleting.
      if (key === "Backspace") {
        const tone = lastToneRef.current;
        if (tone && tone.el === el) {
          const { start, end } = caretOf(el);
          if (start === end && start === tone.caret) {
            const result = telexUndoTone(el.value, start);
            if (result.value !== el.value) {
              setValueReact(el, result.value);
              el.setSelectionRange(result.caret, result.caret);
            }
            lastToneRef.current = null;
            event.preventDefault();
          }
        }
        return;
      }

      // Only compose plain letters (tone keys s/f/r/x/j are letters too).
      if (!LETTER_RE.test(key)) return;

      event.preventDefault();
      const { start, end } = caretOf(el);
      const result = telexInsert(el.value, start, end, key);
      setValueReact(el, result.value);
      el.setSelectionRange(result.caret, result.caret);

      if (TONE_KEYS.has(key.toLowerCase())) {
        lastToneRef.current = { el, caret: result.caret };
      } else {
        lastToneRef.current = null;
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode]);

  const selectMode = (next) => {
    if (next === "vi" || next === "en") setMode(next);
  };

  return (
    <KeyboardModeContext.Provider value={{ mode, selectMode }}>
      {children}
    </KeyboardModeContext.Provider>
  );
}

export function useKeyboardMode() {
  return useContext(KeyboardModeContext);
}
