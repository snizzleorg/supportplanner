# Security Documentation

## XSS (Cross-Site Scripting) Protection

### Overview

The application implements comprehensive XSS protection through **defense in depth** with multiple security layers:

1. **Output Encoding** - Escape user content before display
2. **Input Validation** - Validate format and length on backend
3. **Content Security Policy** - HTTP headers restrict script execution
4. **Secure Data Flow** - Raw storage, escaped display

---

## Security Architecture

### Data Flow

```
┌─────────────┐
│   CalDAV    │ ← Raw data (no escaping)
│  (Storage)  │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│   Backend   │ ← Process raw data
│   (Node.js) │ ← Escape when generating HTML (tooltips)
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Frontend   │ ← Escape before innerHTML
│   (Mobile)  │ ← All user content sanitized
└─────────────┘
```

### Why This Approach?

- **Raw Storage**: CalDAV stores original data without modification
- **Escape at Display**: HTML escaping happens when data is rendered, not stored
- **No Double-Escaping**: Data flows raw until final display
- **Backend Escaping**: Only for HTML generation (tooltips)
- **Frontend Escaping**: All `.innerHTML` usage sanitized

---

## Implementation Details

### 1. Frontend Protection (Mobile App)

**Module**: `mobile/public/js/security.js`

All user-generated content and external data is escaped using `escapeHtml()` before being inserted into the DOM:

```javascript
import { escapeHtml } from './js/security.js';

// ❌ UNSAFE - DO NOT DO THIS
modalTitle.innerHTML = eventTitle;

// ✅ SAFE - Always escape
modalTitle.innerHTML = escapeHtml(eventTitle);
```

**Protected Areas**:
- ✅ Event modal (title, description, location, metadata)
- ✅ Create event modal (all form fields)
- ✅ System experts overlay (system names, expert names)
- ✅ Conflict resolution modal (comparison values)
- ✅ Timeline rendering (event titles, calendar names)
- ✅ All form inputs (HTML attribute values)

**Attack Vectors Prevented**:
```html
<!-- Malicious event title: -->
<script>alert('XSS')</script>

<!-- Gets escaped to: -->
&lt;script&gt;alert('XSS')&lt;/script&gt;

<!-- Displayed as harmless text, not executed -->
```

### 2. Backend Protection

**Module**: `src/utils/html.js`

The backend escapes HTML when generating HTML content (tooltips):

```javascript
import { escapeHtml } from '../utils/html.js';

// Tooltip generation (only place backend creates HTML)
tooltipContent.push(`<div>${escapeHtml(event.summary)}</div>`);
```

**Validation**: `src/middleware/validation.js`

Input validation ensures data format/length, but does NOT escape:
- ❌ No `.escape()` in validation (would escape before storage)
- ✅ `.trim()` removes whitespace
- ✅ `.isLength()` enforces limits
- ✅ `.isISO8601()` validates dates

**Why No Backend Escaping in Validation?**
- Data must be stored raw in CalDAV
- Escaping happens at display time
- Prevents double-escaping issues

### 3. CalDAV Data Handling

**Module**: `src/services/calendar.js`

CalDAV data is:
- ✅ Stored raw (no HTML escaping)
- ✅ Newlines escaped for iCal format (`.replace(/\n/g, '\\n')`)
- ✅ Processed raw throughout backend
- ✅ Escaped only when displayed (frontend) or generating HTML (backend tooltips)

---

## Testing XSS Protection

### Manual Testing

1. **Create malicious event**:
   ```
   Title: <script>alert('XSS')</script>
   Description: <img src=x onerror=alert('XSS')>
   Location: <svg onload=alert('XSS')>
   ```

2. **Expected Result**:
   - Event saves successfully
   - Malicious code displayed as text (not executed)
   - No JavaScript alerts
   - HTML tags visible as text

3. **Verify in**:
   - Event modal (edit view)
   - Timeline (event title)
   - Conflict modal (if editing)
   - System experts (if added there)

### Automated Testing

```bash
# Run backend tests (includes HTML escaping tests)
docker compose run --rm backend-tests

# Check for innerHTML usage without escaping
grep -r "innerHTML" mobile/public/*.js | grep -v "escapeHtml"
# Should only find: innerHTML = escapeHtml(...)
```

---

## Security Functions

### `escapeHtml(unsafe)`

**Purpose**: Convert dangerous HTML characters to safe entities

**Location**: 
- Frontend: `mobile/public/js/security.js`
- Backend: `src/utils/html.js`

**Characters Escaped**:
| Character | Entity | Why |
|-----------|--------|-----|
| `&` | `&amp;` | Start of entities |
| `<` | `&lt;` | Start of tags |
| `>` | `&gt;` | End of tags |
| `"` | `&quot;` | Attribute values |
| `'` | `&#039;` | Attribute values |

**Example**:
```javascript
escapeHtml('<script>alert(1)</script>')
// Returns: '&lt;script&gt;alert(1)&lt;/script&gt;'
```

### `sanitizeObject(obj)`

**Purpose**: Recursively escape all string properties in an object

**Location**: `mobile/public/js/security.js`

**Example**:
```javascript
const unsafe = {
  title: '<script>xss</script>',
  meta: { note: 'Test & Demo' }
};

const safe = sanitizeObject(unsafe);
// Returns: {
//   title: '&lt;script&gt;xss&lt;/script&gt;',
//   meta: { note: 'Test &amp; Demo' }
// }
```

### `setTextContent(element, text)`

**Purpose**: Safely set text content (alternative to innerHTML)

**Location**: `mobile/public/js/security.js`

**Usage**:
```javascript
// Instead of innerHTML for plain text:
element.innerHTML = userInput;  // ❌ Unsafe

// Use textContent:
setTextContent(element, userInput);  // ✅ Always safe
```

---

## Content Security Policy (CSP)

**Module**: `src/config/helmet.js`

HTTP security headers configured via Helmet:

```javascript
{
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Required for inline scripts
      styleSrc: ["'self'", "'unsafe-inline'"],   // Required for inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}
```

**Note**: `'unsafe-inline'` is required because:
- Mobile app uses inline styles for dynamic UI
- Cannot use nonces with service worker caching
- XSS protection relies on output encoding instead

---

## Common Pitfalls & Prevention

### ❌ DON'T: Insert user content directly

```javascript
// NEVER do this
element.innerHTML = event.title;
modal.innerHTML = `<div>${description}</div>`;
```

### ✅ DO: Always escape first

```javascript
// Always escape untrusted data
element.innerHTML = escapeHtml(event.title);
modal.innerHTML = `<div>${escapeHtml(description)}</div>`;
```

### ❌ DON'T: Escape on storage

```javascript
// DON'T escape before saving to CalDAV
const escaped = escapeHtml(title);
await saveToCalDAV({ summary: escaped });  // ❌ Will double-escape
```

### ✅ DO: Escape on display

```javascript
// Store raw, escape on display
await saveToCalDAV({ summary: title });  // ✅ Store raw
element.innerHTML = escapeHtml(title);    // ✅ Escape when displaying
```

---

## Security Checklist

When adding new features that display user content:

- [ ] Import `escapeHtml` from security.js
- [ ] Escape all user data before `.innerHTML`
- [ ] Escape all user data in HTML attributes
- [ ] Test with malicious input: `<script>alert(1)</script>`
- [ ] Verify no JavaScript execution
- [ ] Check network tab for unexpected requests
- [ ] Review console for errors

---

## Attack Scenarios & Mitigations

### Scenario 1: Malicious Event Title
**Attack**: User creates event with title `<script>alert('XSS')</script>`

**Mitigation**:
- Frontend escapes title before displaying in modal
- Timeline escapes title before rendering
- Backend escapes title in tooltips
- **Result**: Displayed as text, not executed

### Scenario 2: XSS in Event Description
**Attack**: Event description contains `<img src=x onerror=alert('XSS')>`

**Mitigation**:
- Frontend escapes description in textarea
- Backend escapes description in tooltips
- **Result**: HTML tags visible as text

### Scenario 3: XSS in Metadata
**Attack**: Order number contains `"><script>alert(1)</script>`

**Mitigation**:
- Frontend escapes all metadata fields
- Form inputs properly quote attributes
- **Result**: Quotes escaped, script not executed

### Scenario 4: Calendar Name XSS
**Attack**: Calendar renamed to `<svg onload=alert(1)>`

**Mitigation**:
- Calendar names escaped in select dropdown
- Calendar labels escaped in timeline
- **Result**: SVG tag displayed as text

### Scenario 5: Stored XSS via CalDAV
**Attack**: Attacker modifies CalDAV event directly with malicious content

**Mitigation**:
- Backend reads raw data but escapes on HTML generation
- Frontend escapes all CalDAV data before display
- **Result**: Malicious content neutralized at display time

---

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Express Validator Documentation](https://express-validator.github.io/docs/)
- [Helmet.js Security](https://helmetjs.github.io/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

## Maintenance

### Adding New Display Code

When adding code that displays user content:

1. **Identify untrusted data** - Anything from CalDAV, user input, or external sources
2. **Import escapeHtml** - Add to imports if not present
3. **Escape before display** - Always use `escapeHtml()` before `.innerHTML`
4. **Test with malicious input** - Verify scripts don't execute
5. **Document** - Update this file if adding new attack surfaces

### Code Review Checklist

When reviewing PRs:
- [ ] No raw `.innerHTML` assignments with user data
- [ ] All user content escaped with `escapeHtml()`
- [ ] Form attributes properly escaped
- [ ] Test cases include XSS attempts
- [ ] No new `'unsafe-eval'` or `'unsafe-inline'` in CSP

---

**Last Updated**: October 17, 2025  
**Version**: 0.5.0+security
