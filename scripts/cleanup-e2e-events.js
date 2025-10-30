#!/usr/bin/env node

/**
 * Manual cleanup script for E2E test events
 * 
 * Usage:
 *   node scripts/cleanup-e2e-events.js
 * 
 * This will search for and delete all events with "E2E" in the summary.
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5175';

async function cleanup() {
  console.log('🧹 E2E Test Event Cleanup Script\n');
  console.log(`   API: ${API_BASE_URL}`);
  console.log('   (Set API_BASE_URL env var to use a different endpoint)\n');

  try {
    // Step 1: Get CSRF token
    console.log('📋 Step 1: Getting CSRF token...');
    const csrfResponse = await fetch(`${API_BASE_URL}/api/csrf-token`);
    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.csrfToken;
    
    const sessionCookie = csrfResponse.headers.get('set-cookie')?.split(';')[0];
    console.log('   ✅ CSRF token obtained\n');

    // Step 2: Get all calendars
    console.log('📋 Step 2: Getting all calendars...');
    const calendarsResponse = await fetch(
      `${API_BASE_URL}/api/calendars`,
      {
        headers: {
          'Cookie': sessionCookie || ''
        }
      }
    );

    if (!calendarsResponse.ok) {
      console.error('   ❌ Failed to get calendars:', calendarsResponse.status);
      process.exit(1);
    }

    const calendarsData = await calendarsResponse.json();
    const calendars = calendarsData.calendars || [];
    const calendarUrls = calendars.map(c => c.url);
    
    console.log(`   ✅ Found ${calendars.length} calendar(s)`);
    if (calendars.length > 0) {
      console.log(`   📅 First calendar: ${calendars[0].displayName || calendars[0].name}\n`);
    } else {
      console.log('');
    }

    // Step 3: Get all events from all calendars (use a very wide date range)
    console.log('📋 Step 3: Fetching all events...');
    const eventsResponse = await fetch(
      `${API_BASE_URL}/api/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Cookie': sessionCookie || ''
        },
        body: JSON.stringify({
          calendarUrls: calendarUrls,
          from: '2024-10-01',  // 1 year range to catch all test events
          to: '2026-01-31'
        })
      }
    );

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('   ❌ Failed to get events:', eventsResponse.status);
      console.error('   Error:', errorText);
      process.exit(1);
    }

    const eventsData = await eventsResponse.json();
    console.log('   🔍 Debug - Events response keys:', Object.keys(eventsData).join(', '));
    
    // The timeline endpoint returns {groups: [...], items: [...]}
    const allEvents = eventsData.items || eventsData.events || [];
    
    // Debug: Show structure of first event
    if (allEvents.length > 0) {
      console.log('   🔍 Debug - First event keys:', Object.keys(allEvents[0]).join(', '));
      console.log('   🔍 Debug - First event content:', allEvents[0].content || allEvents[0].summary || allEvents[0].title);
    }
    
    // Filter for E2E test events (check multiple possible fields)
    const events = allEvents.filter(event => {
      const text = event.summary || event.content || event.title || '';
      return text.includes('E2E');
    });
    
    console.log(`   ✅ Found ${events.length} E2E test events (out of ${allEvents.length} total)\n`);
    
    // Show first few events if found
    if (events.length > 0) {
      console.log('   First 5 E2E events:');
      events.slice(0, 5).forEach(event => {
        const title = event.content || event.summary || event.title;
        const id = event.id || event.uid;
        console.log(`      - ${title} (${id})`);
      });
      console.log('');
    }

    if (events.length === 0) {
      console.log('✨ No E2E test events to clean up!\n');
      process.exit(0);
    }

    // Step 4: Delete each event
    console.log('📋 Step 4: Deleting events...');
    let successCount = 0;
    let failCount = 0;

    for (const event of events) {
      try {
        const title = event.content || event.summary || event.title;
        let eventId = event.id || event.uid;
        
        // Extract UID from CalDAV URL if needed (e.g., https://.../calendar/-uid -> uid)
        if (eventId && eventId.includes('/')) {
          eventId = eventId.split('/').pop();
        }
        // Remove leading dash if present
        if (eventId && eventId.startsWith('-')) {
          eventId = eventId.substring(1);
        }
        
        console.log(`   Deleting: ${title.substring(0, 40)}... (${eventId})`);
        
        const deleteResponse = await fetch(
          `${API_BASE_URL}/api/events/${eventId}`,
          {
            method: 'DELETE',
            headers: {
              'X-CSRF-Token': csrfToken,
              'Content-Type': 'application/json',
              'Cookie': sessionCookie || ''
            }
          }
        );

        if (deleteResponse.ok) {
          successCount++;
          console.log('      ✅ Deleted');
        } else {
          failCount++;
          console.log(`      ⚠️  Failed: ${deleteResponse.status}`);
        }

        // Small delay between deletions
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        failCount++;
        console.log(`      ❌ Error: ${error.message}`);
      }
    }

    console.log(`\n✅ First pass complete!`);
    console.log(`   Deleted: ${successCount}`);
    console.log(`   Failed: ${failCount}\n`);

    // If there were failures, wait and try again
    if (failCount > 0) {
      console.log('⚠️  Some events could not be deleted (cache timing).');
      console.log('   Waiting 30 seconds for cache refresh and retrying...\n');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      console.log('📋 Step 5: Retrying failed deletions...');
      process.exit(0); // Exit for now - user can run script again
    }
    
    console.log('🎉 All E2E test events have been deleted!\n');

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

cleanup();
