/**
 * Tests for dom.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as DOM from '../dom.js';

describe('dom', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="eventModal">
        <div class="modal-content"></div>
        <button class="close-btn"></button>
      </div>
      <form id="eventForm"></form>
      <button id="cancelEdit"></button>
      <button id="saveEvent"></button>
      <button id="deleteEvent"></button>
      <input id="eventId" />
      <input id="eventTitle" />
      <input id="eventStartDate" />
      <input id="eventEndDate" />
      <input id="eventAllDay" type="checkbox" />
      <textarea id="eventDescription"></textarea>
      <input id="eventLocation" />
      <select id="eventCalendar"></select>
      <input id="eventOrderNumber" />
      <input id="eventTicketLink" />
      <input id="eventSystemType" />
      <div id="eventLocationHelp"></div>
      <div id="status"></div>
      <input id="fromDate" />
      <input id="toDate" />
      <div id="fromDateDisplay"></div>
      <div id="toDateDisplay"></div>
      <button id="refreshBtn"></button>
      <button id="fitBtn"></button>
      <button id="todayBtn"></button>
      <button id="monthViewBtn"></button>
      <button id="quarterViewBtn"></button>
      <button id="zoomInBtn"></button>
      <button id="zoomOutBtn"></button>
      <button id="showRangeBtn"></button>
      <input id="searchBox" />
      <button id="clearSearch"></button>
      <div id="timeline"></div>
      <div id="userInfo"></div>
      <button id="logoutBtn"></button>
      <button id="filtersToggle"></button>
      <button id="mapToggle"></button>
      <div id="mobileBackdrop"></div>
    `;
  });

  it('should export all DOM elements', () => {
    expect(DOM.modal).toBeDefined();
    expect(DOM.modalContent).toBeDefined();
    expect(DOM.eventForm).toBeDefined();
    expect(DOM.closeBtn).toBeDefined();
    expect(DOM.cancelBtn).toBeDefined();
    expect(DOM.saveBtn).toBeDefined();
    expect(DOM.deleteBtn).toBeDefined();
  });

  it('should have correct element types', () => {
    expect(DOM.modal.tagName).toBe('DIV');
    expect(DOM.eventForm.tagName).toBe('FORM');
    expect(DOM.saveBtn.tagName).toBe('BUTTON');
    expect(DOM.eventTitleInput.tagName).toBe('INPUT');
    expect(DOM.eventDescriptionInput.tagName).toBe('TEXTAREA');
  });
});
