import { describe, expect, it } from "vitest";
import {
  applyFollowChange,
  cleanSearch,
  followState,
  toContactTab,
  type ContactsPage,
} from "@/lib/contacts";
import { AppError, isNetworkError, toAppError } from "@/lib/offline";
import { shouldPersistQuery } from "@/lib/query-persist";
import type { Query } from "@tanstack/react-query";

describe("follow button state", () => {
  it("shows Follow when neither follows the other", () => {
    expect(followState(false, false)).toBe("follow");
  });
  it("shows Follow back when they follow you but you don't follow them", () => {
    expect(followState(false, true)).toBe("follow_back");
  });
  it("shows Following when only you follow them", () => {
    expect(followState(true, false)).toBe("following");
  });
  it("shows Friends when you follow each other", () => {
    expect(followState(true, true)).toBe("friends");
  });
});

describe("optimistic follow change", () => {
  it("flips only the targeted person across all pages", () => {
    const person = (id: string) => ({
      id,
      fullName: id,
      username: id,
      country: "",
      avatarPath: null,
      avatarUrl: null,
      iFollow: false,
      followsMe: true,
    });
    const data = {
      pageParams: [0, 20],
      pages: [
        { items: [person("a"), person("b")], nextOffset: 20 },
        { items: [person("c")], nextOffset: null },
      ] as ContactsPage[],
    };
    const next = applyFollowChange(data, "c", true);
    expect(next.pages[1]!.items[0]!.iFollow).toBe(true);
    expect(next.pages[0]!.items.every((c) => !c.iFollow)).toBe(true);
    expect(followState(next.pages[1]!.items[0]!.iFollow, true)).toBe("friends");
    expect(data.pages[1]!.items[0]!.iFollow).toBe(false); // original untouched
  });
});

describe("contact tabs and search", () => {
  it("falls back to All for unknown tabs", () => {
    expect(toContactTab("hackers")).toBe("all");
    expect(toContactTab("friends")).toBe("friends");
  });
  it("trims search and caps it at 40 characters", () => {
    expect(cleanSearch("   amara   reads ")).toBe("amara reads");
    expect(cleanSearch("x".repeat(60))).toHaveLength(40);
  });
});

describe("offline handling", () => {
  it("treats fetch failures as no internet", () => {
    expect(isNetworkError({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(toAppError(new TypeError("Load failed")).kind).toBe("network");
  });
  it("never passes raw server text to the screen", () => {
    const err = toAppError({ message: 'relation "follows" violates policy xyz' });
    expect(err).toBeInstanceOf(AppError);
    expect(err.kind).toBe("server");
    expect(err.message).not.toContain("follows");
  });
  it("saves contact lists for offline but not one-off searches", () => {
    const q = (key: unknown[]) => ({ queryKey: key, state: { status: "success" } }) as unknown as Query;
    expect(shouldPersistQuery(q(["contacts", "all", ""]))).toBe(true);
    expect(shouldPersistQuery(q(["contacts", "all", "amara"]))).toBe(false);
    expect(shouldPersistQuery(q(["contact-counts"]))).toBe(true);
  });
});
