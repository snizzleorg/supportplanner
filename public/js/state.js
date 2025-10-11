/**
 * Application State Management
 * 
 * Centralized state management for the application.
 * Manages timeline data, user state, and application configuration.
 * 
 * @module state
 */

import { DataSet } from 'https://cdn.jsdelivr.net/npm/vis-timeline@7.7.3/standalone/esm/vis-timeline-graph2d.min.js';

/**
 * Timeline instance
 * @type {Timeline|null}
 */
export let timeline = null;

/**
 * Timeline groups DataSet
 * @type {DataSet}
 */
export let groups = new DataSet([]);

/**
 * Timeline items DataSet
 * @type {DataSet}
 */
export let items = new DataSet([]);

/**
 * Whether user is currently panning the timeline
 * @type {boolean}
 */
export let isPanning = false;

/**
 * Timestamp of last pan end event
 * @type {number}
 */
export let lastPanEnd = 0;

/**
 * MutationObserver for timeline labels
 * @type {MutationObserver|null}
 */
export let labelObserver = null;

/**
 * Week bar overlay container element
 * @type {HTMLElement|null}
 */
export let weekBarEl = null;

/**
 * Refresh generation counter for in-flight refresh tracking
 * @type {number}
 */
export let refreshGen = 0;

/**
 * Map of timeline group IDs to original server group IDs (calendar URLs)
 * @type {Map<string, string>}
 */
export const groupReverseMap = new Map();

/**
 * Map of calendar URLs to timeline group IDs
 * @type {Map<string, string>}
 */
export const urlToGroupId = new Map();

/**
 * Currently selected/edited event
 * @type {Object|null}
 */
export let currentEvent = null;

/**
 * Last geocode result
 * @type {Object|null}
 */
export let lastGeocode = null;

/**
 * Group ID for current create flow (optimistic insert)
 * @type {string|null}
 */
export let currentCreateGroupId = null;

/**
 * Current user's role
 * @type {string}
 */
export let currentUserRole = 'reader';

/**
 * Debug UI flag
 * @type {boolean}
 * @constant
 */
export const DEBUG_UI = false;

/**
 * Sets the timeline instance
 * @param {Timeline} timelineInstance - The vis-timeline instance
 */
export function setTimeline(timelineInstance) {
  timeline = timelineInstance;
}

/**
 * Sets the current event being edited
 * @param {Object|null} event - The event object or null
 */
export function setCurrentEvent(event) {
  currentEvent = event;
}

/**
 * Sets the last geocode result
 * @param {Object|null} geocode - The geocode result or null
 */
export function setLastGeocode(geocode) {
  lastGeocode = geocode;
}

/**
 * Sets the current user role
 * @param {string} role - The user role (reader, editor, admin)
 */
export function setCurrentUserRole(role) {
  currentUserRole = role;
}

/**
 * Sets the panning state
 * @param {boolean} panning - Whether the user is currently panning
 */
export function setIsPanning(panning) {
  isPanning = panning;
}

/**
 * Sets the last pan end timestamp
 * @param {number} timestamp - The timestamp when panning ended
 */
export function setLastPanEnd(timestamp) {
  lastPanEnd = timestamp;
}

/**
 * Sets the label observer
 * @param {MutationObserver|null} observer - The mutation observer instance
 */
export function setLabelObserver(observer) {
  labelObserver = observer;
}

/**
 * Sets the week bar element
 * @param {HTMLElement|null} element - The week bar container element
 */
export function setWeekBarEl(element) {
  weekBarEl = element;
}

/**
 * Increments the refresh generation counter
 * @returns {number} The new refresh generation number
 */
export function incrementRefreshGen() {
  refreshGen++;
  return refreshGen;
}

/**
 * Sets the current create group ID
 * @param {string|null} groupId - The group ID for the current create flow
 */
export function setCurrentCreateGroupId(groupId) {
  currentCreateGroupId = groupId;
}

/**
 * Clears all timeline data
 */
export function clearTimelineData() {
  items.clear();
  groups.clear();
  groupReverseMap.clear();
  urlToGroupId.clear();
}

/**
 * Resets all state to initial values
 */
export function resetState() {
  clearTimelineData();
  currentEvent = null;
  lastGeocode = null;
  currentCreateGroupId = null;
  isPanning = false;
  lastPanEnd = 0;
  refreshGen = 0;
}
