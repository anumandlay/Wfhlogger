# Downloads Page: Python Client & OS Guides

## Goals
- Add a second download option: a single-file Python client (.py) alongside the existing Windows installer.
- Provide clear step-by-step installation/run guides for Windows, Linux, and macOS.
- Ensure the page has a modern, sleek UI that respects dark/light modes.
- Avoid stale links by using the existing dynamic API base resolution.

## Frontend Updates
### Downloads Page UI
- Replace the current single-card layout with a two-option hero:
  - Windows Installer card: primary CTA to download `TimeTrackerSetup.exe`
  - Python Script card: secondary CTA to download `TimeTracker.py`
- Below the hero, add an "Installation Guides" section with three collapsible panels (Windows, Linux, macOS).
- Each guide includes:
  - Dependencies (Python ≥ 3.10, pip, Tk/Tcl where applicable)
  - pip packages (from requirements.txt)
  - Run instructions
  - Troubleshooting steps
- Detect OS (navigator.platform) to pre-select the best option but keep all options visible.
- Use existing tailwind dark/light classes consistent with the app’s design.

### Code Changes
- Edit `web/src/pages/Downloads.jsx`:
  - Inject a second download link: `const pyUrl = `${apiBase}/downloads/TimeTracker.py``
  - Build two CTA cards with icons, concise copy, and download buttons
  - Add a new section with `<details>` or a custom accordion for Windows, Linux, macOS guides
  - Keep using `resolveApiBase()` for link base

## Backend/Assets
- Place `TimeTracker.py` in `public/downloads/` so the existing `/downloads` static route serves it.
- Confirm `/downloads` route already falls back to `public/downloads` (it does).
- Ensure `desktop/requirements.txt` includes all Python deps used by the client:
  - Add `tkcalendar` since `app.py` imports it
- Optionally add `public/downloads/requirements.txt` mirroring `desktop/requirements.txt` for convenience (not strictly required since steps will use pip install inline).

## Guide Content (to embed in page)
### Windows (.exe)
- Download and run `TimeTrackerSetup.exe`. Follow installer prompts.
- Launch the app, enter Backend URL (e.g., `http://localhost:4000`), email/password, then Continue.
- Troubleshooting:
  - If blocked by SmartScreen, choose "Run anyway".
  - If you see connection errors, verify backend is running at `http://localhost:4000`.

### Windows (Python .py)
- Requirements:
  - Python ≥ 3.10 (install from python.org, check "Add Python to PATH")
  - pip installed
- Install dependencies:
  - `pip install requests mss Pillow python-socketio websocket-client tkcalendar`
- Run:
  - Download `TimeTracker.py` from Downloads page
  - Open Command Prompt and run: `python TimeTracker.py`
- Troubleshooting:
  - If tkinter missing: re-run Python installer and add "tcl/tk and IDLE"; or install `pip install tkcalendar`
  - If connection error: verify backend URL and firewall rules

### Linux (Python .py)
- Requirements:
  - Python ≥ 3.10, pip
  - Tk/Tcl (for tkinter UI)
- Install system deps (Ubuntu/Debian example):
  - `sudo apt update && sudo apt install -y python3 python3-pip python3-tk`
- Install Python packages:
  - `pip3 install requests mss Pillow python-socketio websocket-client tkcalendar`
- Run:
  - `python3 TimeTracker.py`
- Troubleshooting:
  - Wayland/X11: ensure Tk works; if missing, install `python3-tk`
  - If screenshots fail, verify `mss` supports your display setup

### macOS (Python .py)
- Requirements:
  - Python ≥ 3.10 (Homebrew recommended), Tk/Tcl
- Install via Homebrew:
  - `brew install python@3.11` (or newer)
  - `brew install tcl-tk`
  - Export paths if needed: `export PATH="/usr/local/opt/python@3.11/bin:$PATH"`
- Install Python packages:
  - `pip3 install requests mss Pillow python-socketio websocket-client tkcalendar`
- Run:
  - `python3 TimeTracker.py`
- Troubleshooting:
  - If tkinter fails, ensure `tcl-tk` is installed and Python is linked against it
  - Grant screen recording permissions in System Settings → Privacy & Security

## UX Refinements
- Add version label and hashes under each download (optional, if available).
- Provide a "Verify installation" note pointing to Live View and Dashboard pages.
- Include a short FAQ: backend URL, login roles, desktop ↔ web handoff.

## Acceptance Criteria Mapping
- Manual `.py` download available alongside Windows installer
- Guides for Windows (.exe), Linux/macOS (.py) included with dependencies, Python version, run steps, troubleshooting
- Modern, sleek UI with dark/light mode respected
- Links use dynamic API base; no hardcoded origins

## Implementation Checklist
1. Add `TimeTracker.py` into `public/downloads/` (single-file Python client)
2. Add `tkcalendar` to `desktop/requirements.txt`
3. Update `Downloads.jsx` with new UI, links, and guides
4. Verify `/downloads/TimeTracker.py` is served by backend
5. Manual test on Windows/macOS/Linux in dev for copy correctness

Please confirm and I’ll implement these changes.