# UI Customization Guide

## Calendar Lane Colors

All calendar lane colors are now centrally configured in a single file for easy customization.

### Configuration File

**Location:** `public/js/ui-config.js`

This file contains:
- `LABEL_PALETTE` - Array of 10 hex colors for calendar labels and lane backgrounds
- `LANE_OPACITY` - Opacity value (0-1) for lane background tints

### How to Customize Colors

1. Open `public/js/ui-config.js`
2. Edit the `LABEL_PALETTE` array with your desired hex colors
3. Optionally adjust `LANE_OPACITY` (default: 0.14 = 14%)
4. Refresh your browser (no rebuild needed)

### Example: Change Colors

```javascript
export const LABEL_PALETTE = [
  '#FFE5E5', // Calendar 1 - Soft red/pink
  '#E5F3FF', // Calendar 2 - Soft blue
  '#E8FFE5', // Calendar 3 - Soft green
  // ... add more colors as needed
];
```

### Pre-configured Palettes

The config file includes three ready-to-use palettes:

#### 1. Default High-Contrast (Active)
Soft, professional colors with good distinction:
- `#FFE5E5`, `#E5F3FF`, `#E8FFE5`, etc.

#### 2. Stronger High-Contrast (Commented)
More saturated for even better visibility:
- `#FFD6D6`, `#D6E9FF`, `#D6FFD6`, etc.

#### 3. Vibrant (Commented)
Bold, eye-catching colors:
- `#FFCCCC`, `#CCE5FF`, `#CCFFCC`, etc.

To switch palettes, simply comment out the current `LABEL_PALETTE` and uncomment your preferred option.

### Adjusting Opacity

If lane backgrounds are too strong or too subtle:

```javascript
// Lighter tint (more subtle)
export const LANE_OPACITY = 0.08;

// Current default
export const LANE_OPACITY = 0.14;

// Stronger tint (more visible)
export const LANE_OPACITY = 0.20;
```

### Color Selection Tips

**For maximum contrast:**
- Use colors from different parts of the color wheel
- Alternate warm and cool tones
- Ensure sufficient brightness difference between adjacent colors

**For accessibility:**
- Keep colors light enough for dark text to be readable
- Avoid very saturated colors that can cause eye strain
- Test with colorblind simulation tools if possible

**Color wheel positions:**
- Red → Blue → Green → Orange → Purple → Yellow → Cyan → Magenta
- This sequence maximizes visual distinction

### Testing Your Changes

1. Edit `public/js/ui-config.js`
2. Save the file
3. Refresh browser (Cmd+R / F5)
4. Check both label colors and lane background tints
5. Verify events remain clearly readable

### Troubleshooting

**Colors not updating?**
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Check browser console for import errors
- Verify hex color format (must start with #)

**Lane backgrounds too strong?**
- Reduce `LANE_OPACITY` value
- Use lighter base colors in palette

**Need more than 10 colors?**
- Simply add more hex colors to the `LABEL_PALETTE` array
- Colors will cycle if you have more than 10 calendars

## Related Files

- `public/js/ui-config.js` - Color configuration (edit this)
- `public/js/timeline-ui.js` - Implementation (don't edit unless changing logic)
- `public/styles.css` - Additional styling
