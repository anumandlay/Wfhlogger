## Scope
- Ensure Country and Timezone dropdowns are fully readable in dark mode across Signup, Admin (Create Manager), and Setup (Add Employee)

## Current State
- Searchable dropdown component (SearchableSelect) already switches backgrounds and borders for dark mode (dark:bg-slate-900, dark:border-slate-700)
- Option text color is not explicitly set inside the dropdown panel, which can reduce contrast in dark mode

## Changes
### Update SearchableSelect styling
1. Dropdown panel: add text color classes
   - Add `text-slate-900 dark:text-slate-100` to the dropdown container to ensure global text contrast in both themes
2. Option items: add explicit text color and clearer hover/active states
   - Add `text-slate-700 dark:text-slate-200` for option rows
   - Keep `hover:bg-slate-50 dark:hover:bg-slate-800` for a clear visual hover in both themes
   - Preserve selected state background: `bg-slate-50 dark:bg-slate-800`
3. Placeholder visibility
   - Ensure button label shows placeholder with sufficient contrast (already inherits from button text classes)
4. Focus ring
   - Retain `focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500` for modern look and accessibility

### Verification
- Toggle dark mode and verify:
  - CountrySelect and TimezoneSelect dropdown items have high contrast text (light text on dark background)
  - Search input field inside the dropdown remains readable
- Pages to check:
  - Signup (Country/Timezone)
  - Admin → Create Manager (Country/Timezone)
  - Setup → Add Employee (Country/Timezone)

## Implementation Files
- Update: `web/src/components/FormControls.jsx` (SearchableSelect)

## Outcome
- Dropdown UI readable and visually consistent with modern SaaS dark mode, with clear hover/selected states and sufficient text contrast.