"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLang } from "@/lib/i18n";
import { isDictionaryReady, loadDictionary, subscribeDictionary, translateBlock, translateText } from "@/lib/translate";

// When Nepali is chosen this walks the whole page and replaces the English words, and keeps doing so for anything the
// app draws later (new screens, lists, messages). Switching back to English restores the original text. It changes only
// text nodes and a few attributes, so the app's own code keeps working exactly as before.

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "TITLE"]);
const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;

type Rec = { orig: string; shown: string };
const textRecs = new WeakMap<Text, Rec>();
const attrRecs = new WeakMap<Element, Map<string, Rec>>();
const touchedText = new Set<Text>();
const touchedEls = new Set<Element>();

const skipped = (el: Element | null): boolean => {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (SKIP.has(n.tagName.toUpperCase())) return true;
    if (n.getAttribute("translate") === "no") return true;
  }
  return false;
};

// the English text a node held before we translated it (or what it holds now when the app has just changed it)
const originalOf = (n: Text): string => {
  const r = textRecs.get(n);
  const cur = n.nodeValue ?? "";
  return r && r.shown === cur ? r.orig : cur;
};

function setText(n: Text, orig: string, shown: string) {
  if (n.nodeValue !== shown) n.nodeValue = shown;
  if (shown === orig) {
    textRecs.delete(n);
  } else {
    textRecs.set(n, { orig, shown });
    touchedText.add(n);
  }
}

function translateElement(el: Element) {
  if (skipped(el)) return;
  const kids = Array.from(el.childNodes);
  const texts = kids.filter((k): k is Text => k.nodeType === 3);
  if (texts.length >= 2 && texts.length === kids.length) {
    // one sentence the app drew as several pieces (text and values side by side): translate it as a whole
    const origs = texts.map(originalOf);
    const whole = translateBlock(origs.join(""));
    if (whole !== null) {
      texts.forEach((t, i) => setText(t, origs[i], i === 0 ? whole : ""));
      translateAttrs(el);
      return;
    }
  }
  for (const t of texts) {
    const orig = originalOf(t);
    setText(t, orig, translateText(orig));
  }
  translateAttrs(el);
}

function translateAttrs(el: Element) {
  for (const name of ATTRS) {
    const cur = el.getAttribute(name);
    if (!cur) continue;
    let recs = attrRecs.get(el);
    const r = recs?.get(name);
    const orig = r && r.shown === cur ? r.orig : cur;
    const shown = translateText(orig);
    if (shown === orig) {
      recs?.delete(name);
      if (shown !== cur) el.setAttribute(name, shown);
      continue;
    }
    if (shown !== cur) el.setAttribute(name, shown);
    if (!recs) attrRecs.set(el, (recs = new Map()));
    recs.set(name, { orig, shown });
    touchedEls.add(el);
  }
}

function translateTree(root: Element) {
  translateElement(root);
  root.querySelectorAll("*").forEach(translateElement);
}

function restoreAll() {
  touchedText.forEach((n) => {
    const r = textRecs.get(n);
    if (r && r.shown === n.nodeValue) n.nodeValue = r.orig;
    textRecs.delete(n);
  });
  touchedText.clear();
  touchedEls.forEach((el) => {
    attrRecs.get(el)?.forEach((r, name) => {
      if (el.getAttribute(name) === r.shown) el.setAttribute(name, r.orig);
    });
    attrRecs.delete(el);
  });
  touchedEls.clear();
}

export default function PageTranslator() {
  const [lang] = useLang();
  const ready = useSyncExternalStore(subscribeDictionary, isDictionaryReady, () => false);

  useEffect(() => {
    if (lang === "ne") void loadDictionary();
  }, [lang]);

  useEffect(() => {
    if (lang !== "ne" || !ready) {
      restoreAll();
      return;
    }
    const root = document.body;
    translateTree(root);

    const dirty = new Set<Element>();
    const added = new Set<Element>();
    let frame = 0;
    const flush = () => {
      frame = 0;
      added.forEach((el) => el.isConnected && translateTree(el));
      dirty.forEach((el) => el.isConnected && !added.has(el) && translateElement(el));
      added.clear();
      dirty.clear();
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const obs = new MutationObserver((records) => {
      for (const m of records) {
        if (m.type === "characterData") {
          const p = m.target.parentElement;
          if (p) dirty.add(p);
        } else if (m.type === "childList") {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1) added.add(n as Element);
            else if (n.nodeType === 3 && m.target.nodeType === 1) dirty.add(m.target as Element);
          });
          if (m.removedNodes.length && m.target.nodeType === 1) dirty.add(m.target as Element);
        } else if (m.type === "attributes" && m.target.nodeType === 1) {
          dirty.add(m.target as Element);
        }
      }
      queue();
    });
    obs.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });

    return () => {
      obs.disconnect();
      if (frame) cancelAnimationFrame(frame);
      restoreAll();
    };
  }, [lang, ready]);

  return null;
}
