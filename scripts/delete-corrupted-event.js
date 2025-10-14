#!/usr/bin/env node

/**
 * Delete corrupted event directly via CalDAV
 * 
 * Usage: node scripts/delete-corrupted-event.js <calendar-url> <event-uid>
 * 
 * This script attempts to delete an event that can't be deleted through
 * normal means due to corruption. It tries multiple approaches:
 * 1. Direct DELETE request to the event URL
 * 2. Fetch and delete using different ETags
 * 3. Force delete without ETag
 */

import { DAVClient } from 'tsdav';
import dotenv from 'dotenv';

dotenv.config();

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL;
const NEXTCLOUD_USERNAME = process.env.NEXTCLOUD_USERNAME;
const NEXTCLOUD_PASSWORD = process.env.NEXTCLOUD_PASSWORD;

async function deleteCorruptedEvent(calendarUrl, eventUid) {
  console.log('🔧 Corrupted Event Cleanup Tool');
  console.log('================================');
  console.log(`Calendar: ${calendarUrl}`);
  console.log(`Event UID: ${eventUid}`);
  console.log('');

  try {
    // 1. Create DAV client
    console.log('Step 1: Connecting to CalDAV server...');
    const client = new DAVClient({
      serverUrl: NEXTCLOUD_URL,
      credentials: {
        username: NEXTCLOUD_USERNAME,
        password: NEXTCLOUD_PASSWORD,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });

    await client.login();
    console.log('✓ Connected successfully');
    console.log('');

    // 2. Fetch calendars
    console.log('Step 2: Finding calendar...');
    const calendars = await client.fetchCalendars();
    const calendar = calendars.find(cal => cal.url === calendarUrl);
    
    if (!calendar) {
      console.error('✗ Calendar not found!');
      console.log('Available calendars:');
      calendars.forEach(cal => console.log(`  - ${cal.url}`));
      process.exit(1);
    }
    console.log('✓ Calendar found');
    console.log('');

    // 3. Fetch all calendar objects
    console.log('Step 3: Fetching calendar objects...');
    const objects = await client.fetchCalendarObjects({
      calendar: calendar,
      expand: true
    });
    console.log(`✓ Found ${objects.length} objects`);
    console.log('');

    // 4. Find the corrupted event
    console.log('Step 4: Looking for corrupted event...');
    const corruptedEvent = objects.find(obj => 
      obj.data && obj.data.includes(`UID:${eventUid}`)
    );

    if (!corruptedEvent) {
      console.error('✗ Event not found!');
      console.log('Events in calendar:');
      objects.forEach(obj => {
        const uidMatch = obj.data?.match(/UID:([^\r\n]+)/);
        if (uidMatch) {
          console.log(`  - ${uidMatch[1]}`);
        }
      });
      process.exit(1);
    }

    console.log('✓ Found corrupted event:');
    console.log(`  URL: ${corruptedEvent.url}`);
    console.log(`  ETag: ${corruptedEvent.etag}`);
    console.log('');

    // 5. Attempt deletion methods
    console.log('Step 5: Attempting deletion...');
    
    // Method 1: Try with ETag
    try {
      console.log('  Method 1: Delete with ETag...');
      await client.deleteCalendarObject({
        calendarObject: corruptedEvent,
        etag: corruptedEvent.etag
      });
      console.log('  ✓ Successfully deleted with ETag!');
      console.log('');
      console.log('🎉 Event deleted successfully!');
      return;
    } catch (error) {
      console.log(`  ✗ Failed with ETag: ${error.message}`);
    }

    // Method 2: Try without ETag (force delete)
    try {
      console.log('  Method 2: Force delete without ETag...');
      await client.deleteCalendarObject({
        calendarObject: corruptedEvent
      });
      console.log('  ✓ Successfully force deleted!');
      console.log('');
      console.log('🎉 Event deleted successfully!');
      return;
    } catch (error) {
      console.log(`  ✗ Failed force delete: ${error.message}`);
    }

    // Method 3: Direct HTTP DELETE
    try {
      console.log('  Method 3: Direct HTTP DELETE...');
      const response = await fetch(corruptedEvent.url, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_PASSWORD}`).toString('base64'),
          'If-Match': corruptedEvent.etag || '*'
        }
      });
      
      if (response.ok || response.status === 204) {
        console.log('  ✓ Successfully deleted via HTTP!');
        console.log('');
        console.log('🎉 Event deleted successfully!');
        return;
      } else {
        console.log(`  ✗ HTTP DELETE failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`  ✗ HTTP DELETE error: ${error.message}`);
    }

    console.log('');
    console.error('❌ All deletion methods failed!');
    console.log('');
    console.log('Manual cleanup required:');
    console.log('1. Access Nextcloud server directly (SSH/file system)');
    console.log('2. Navigate to calendar data directory');
    console.log(`3. Delete file: ${eventUid}.ics`);
    console.log('');
    console.log('Or contact Nextcloud administrator for assistance.');
    process.exit(1);

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error('Usage: node scripts/delete-corrupted-event.js <calendar-url> <event-uid>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/delete-corrupted-event.js \\');
  console.error('    "https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_ruettinger/" \\');
  console.error('    "fe9330c6-ce00-4db0-9499-e052de945168"');
  process.exit(1);
}

const [calendarUrl, eventUid] = args;

deleteCorruptedEvent(calendarUrl, eventUid);
