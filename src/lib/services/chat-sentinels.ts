/**
 * Client-routed sentinel queries used by ActionBar / MeetingBrief / clusters.
 * Centralized so the matching logic in components and the emitting logic in
 * builders stay in lockstep.
 */
export const SENTINEL_EDIT_EMAIL = "__edit_email__";
export const SENTINEL_COPY_EMAIL = "__copy_email__";
export const SENTINEL_TOGGLE_BRIEF = "__toggle_brief__";
