import os
import io
import time
import base64
import threading
import requests
import socketio
import webbrowser
from urllib.parse import urlencode, urlparse
from datetime import datetime, timezone, timedelta

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
    from tkinter import font as tkfont
    from tkcalendar import DateEntry
except Exception:
    raise RuntimeError('Tkinter and tkcalendar are required to run the desktop client.')

try:
    import mss
    from PIL import Image, ImageTk
except Exception:
    raise RuntimeError('Install dependencies from requirements.txt (mss, Pillow).')


# Default configuration
DEFAULT_BACKEND_URL = os.environ.get('BACKEND_URL', 'https://wfhlogger.com')
SCREENSHOT_INTERVAL_SECONDS = int(os.environ.get('SCREENSHOT_INTERVAL_SECONDS', '180'))
LIVE_VIEW_INTERVAL_SECONDS = 2
HEARTBEAT_INTERVAL_SECONDS = int(os.environ.get('HEARTBEAT_INTERVAL_SECONDS', '60'))


class TimeTrackerApp:
    def __init__(self, root):
        self.root = root
        root.title('TimeTracker')
        # Square-ish modern aspect ratio
        root.geometry('400x480')
        root.resizable(False, False)

        # ----- Modern styling -----
        self.style = ttk.Style()
        try:
            self.style.theme_use('clam')
        except tk.TclError:
            pass

        # Fonts
        self.font_body = tkfont.Font(family='Segoe UI', size=10)
        self.font_small = tkfont.Font(family='Segoe UI', size=9)
        self.font_heading = tkfont.Font(family='Segoe UI', size=14, weight='bold')
        self.font_hero = tkfont.Font(family='Segoe UI', size=28, weight='bold')
        self.root.option_add('*Font', self.font_body)

        # Colors - SaaS Palette
        self.color_bg = '#F8FAFC'      # Slate 50
        self.color_surface = '#FFFFFF' # White
        self.color_text = '#0F172A'    # Slate 900
        self.color_muted = '#64748B'   # Slate 500
        self.color_primary = '#2563EB' # Blue 600
        self.color_primary_hover = '#1D4ED8' # Blue 700
        self.color_success = '#16A34A' # Green 600
        self.color_error = '#EF4444'   # Red 500
        self.color_border = '#E2E8F0'  # Slate 200

        self.root.configure(bg=self.color_bg)

        # Configure TTK Styles
        self.style.configure('TFrame', background=self.color_bg)
        self.style.configure('Surface.TFrame', background=self.color_surface, relief='flat')
        
        self.style.configure('TLabel', background=self.color_bg, foreground=self.color_text)
        self.style.configure('Surface.TLabel', background=self.color_surface, foreground=self.color_text)
        self.style.configure('Muted.TLabel', background=self.color_bg, foreground=self.color_muted, font=self.font_small)
        self.style.configure('Heading.TLabel', background=self.color_bg, foreground=self.color_text, font=self.font_heading)
        self.style.configure('Hero.TLabel', background=self.color_bg, foreground=self.color_text, font=self.font_hero)
        
        # Modern Buttons
        self.style.configure('Primary.TButton', 
            font=('Segoe UI', 10, 'bold'), 
            background=self.color_primary, 
            foreground='white', 
            borderwidth=0, 
            focuscolor=self.color_primary,
            padding=10
        )
        self.style.map('Primary.TButton', 
            background=[('active', self.color_primary_hover), ('pressed', self.color_primary_hover)]
        )

        self.style.configure('Danger.TButton', 
            font=('Segoe UI', 10, 'bold'), 
            background=self.color_error, 
            foreground='white', 
            borderwidth=0, 
            focuscolor=self.color_error,
            padding=10
        )
        self.style.map('Danger.TButton', 
            background=[('active', '#DC2626'), ('pressed', '#B91C1C')]
        )
        
        self.style.configure('Ghost.TButton',
            font=('Segoe UI', 9),
            background=self.color_bg,
            foreground=self.color_muted,
            borderwidth=0,
            padding=4
        )
        self.style.map('Ghost.TButton',
            foreground=[('active', self.color_text)]
        )

        # Input fields
        self.style.configure('TEntry', 
            fieldbackground=self.color_surface, 
            borderwidth=1, 
            relief='solid', 
            padding=8
        )

        # State
        self.token = None
        self.email = tk.StringVar()
        self.password = tk.StringVar()
        self.server_url = tk.StringVar(value=DEFAULT_BACKEND_URL)
        self.tracking = False
        self.live_view_active = False
        self.sio = None
        self.tracker_thread = None
        self.heartbeat_thread = None
        self._stop_event = threading.Event()
        self._live_stop_event = threading.Event()
        self.live_thread = None
        self.capture_interval_seconds = SCREENSHOT_INTERVAL_SECONDS
        self.backend_url = DEFAULT_BACKEND_URL
        self.effective_timezone = 'UTC'

        # Build UI Container
        self.container = ttk.Frame(self.root)
        self.container.pack(fill=tk.BOTH, expand=True)

        self.current_frame = None
        self._show_login_frame()

        try:
            self.root.protocol('WM_DELETE_WINDOW', self._on_close)
        except Exception:
            pass

    def _clear_frame(self):
        if self.current_frame:
            self.current_frame.destroy()
        self.current_frame = None

    def _show_login_frame(self):
        self._clear_frame()
        self.current_frame = ttk.Frame(self.container, padding=30)
        self.current_frame.pack(fill=tk.BOTH, expand=True)

        # Logo / Brand
        ttk.Label(self.current_frame, text="TimeTracker", style='Heading.TLabel').pack(pady=(20, 5))
        ttk.Label(self.current_frame, text="Sign in to your workspace", style='Muted.TLabel').pack(pady=(0, 25))

        # Form
        form_frame = ttk.Frame(self.current_frame)
        form_frame.pack(fill=tk.X)

        # Credentials
        ttk.Label(form_frame, text="Email", style='Muted.TLabel').pack(anchor='w', pady=(0, 4))
        ttk.Entry(form_frame, textvariable=self.email).pack(fill=tk.X, pady=(0, 12))

        ttk.Label(form_frame, text="Password", style='Muted.TLabel').pack(anchor='w', pady=(0, 4))
        ttk.Entry(form_frame, textvariable=self.password, show="•").pack(fill=tk.X, pady=(0, 20))

        # Login Button
        self.login_btn = ttk.Button(form_frame, text="Continue", style='Primary.TButton', command=self.login)
        self.login_btn.pack(fill=tk.X)

        ttk.Button(form_frame, text="Open Web Login", style='Ghost.TButton', command=self.open_web_login).pack(fill=tk.X, pady=(10, 0))

        # Footer
        ttk.Label(self.current_frame, text="v1.0.0 • Secure Client", style='Muted.TLabel', font=('Segoe UI', 8)).pack(side=tk.BOTTOM, pady=10)

    def _show_dashboard_frame(self):
        self._clear_frame()
        self.current_frame = ttk.Frame(self.container)
        self.current_frame.pack(fill=tk.BOTH, expand=True)

        # 1. Header
        header = ttk.Frame(self.current_frame, style='Surface.TFrame', padding=(20, 15))
        header.pack(fill=tk.X)
        
        # Flex layout manually
        header.columnconfigure(1, weight=1)
        
        # Avatar
        avatar_bg = self.color_primary
        avatar = tk.Label(header, text=self.email.get()[0].upper(), bg=avatar_bg, fg='white', 
                         font=('Segoe UI', 11, 'bold'), width=3, height=1)
        avatar.grid(row=0, column=0, rowspan=2, padx=(0, 10))
        
        # User details
        ttk.Label(header, text=self.email.get(), style='Surface.TLabel', font=('Segoe UI', 9, 'bold')).grid(row=0, column=1, sticky='w')
        self.status_lbl = ttk.Label(header, text="Online", style='Muted.TLabel', foreground=self.color_success)
        self.status_lbl.grid(row=1, column=1, sticky='w')

        # Logout Icon Button
        ttk.Button(header, text="Sign Out", style='Ghost.TButton', command=self.logout).grid(row=0, column=2, rowspan=2)

        # 2. Hero Section
        hero = ttk.Frame(self.current_frame, padding=30)
        hero.pack(fill=tk.BOTH, expand=True)

        # Stats Grid
        stats_frame = ttk.Frame(hero)
        stats_frame.pack(fill=tk.X, pady=(20, 30))
        
        # Active Time (Left)
        active_col = ttk.Frame(stats_frame)
        active_col.pack(side=tk.LEFT, expand=True)
        ttk.Label(active_col, text="ACTIVE TIME", style='Muted.TLabel', font=('Segoe UI', 8, 'bold'), foreground=self.color_primary).pack()
        self.active_time_var = tk.StringVar(value="00:00:00")
        ttk.Label(active_col, textvariable=self.active_time_var, style='Hero.TLabel', font=('Segoe UI', 22, 'bold')).pack()

        # Idle Time (Right)
        idle_col = ttk.Frame(stats_frame)
        idle_col.pack(side=tk.RIGHT, expand=True)
        ttk.Label(idle_col, text="IDLE TIME", style='Muted.TLabel', font=('Segoe UI', 8, 'bold'), foreground=self.color_error).pack()
        self.idle_time_var = tk.StringVar(value="00:00:00")
        ttk.Label(idle_col, textvariable=self.idle_time_var, style='Hero.TLabel', font=('Segoe UI', 22, 'bold')).pack()

        # Big Action Button
        self.action_btn = ttk.Button(hero, text="Start Tracking", style='Primary.TButton', command=self.toggle_tracking)
        self.action_btn.pack(fill=tk.X, ipady=4)

        # Status
        self.capture_status_var = tk.StringVar(value="Ready to start")
        ttk.Label(hero, textvariable=self.capture_status_var, style='Muted.TLabel', justify='center').pack(pady=15)

        # Request Missed Time
        ttk.Button(hero, text="Request Missed Time", style='Ghost.TButton', command=self.request_time).pack(pady=(0, 5))

        ttk.Button(hero, text="View Dashboard in Web", style='Ghost.TButton', command=self.open_web_dashboard).pack(pady=(0, 5))

        # 3. Footer Stats
        footer = ttk.Frame(self.current_frame, style='Surface.TFrame', padding=15)
        footer.pack(fill=tk.X, side=tk.BOTTOM)
        
        f_grid = ttk.Frame(footer, style='Surface.TFrame')
        f_grid.pack(fill=tk.X)
        
        # Last Sync (Center)
        center = ttk.Frame(f_grid, style='Surface.TFrame')
        center.pack(expand=True)
        ttk.Label(center, text="LAST UPLOAD", style='Muted.TLabel', font=('Segoe UI', 7, 'bold')).pack(side=tk.LEFT, padx=(0,5))
        self.last_upload_var = tk.StringVar(value="-")
        ttk.Label(center, textvariable=self.last_upload_var, style='Surface.TLabel', font=('Segoe UI', 9)).pack(side=tk.LEFT)

    # --- Logic Methods ---

    def toggle_tracking(self):
        if self.tracking:
            self.stop_tracking()
        else:
            self.start_tracking()

    def _get_frontend_base(self):
        env_url = os.environ.get('FRONTEND_URL', '').strip()
        if env_url:
            return env_url.rstrip('/')
        try:
            parsed = urlparse(self.backend_url)
            if parsed.hostname in ('localhost', '127.0.0.1'):
                return 'http://localhost:5173'
            if parsed.scheme and parsed.hostname:
                return f'{parsed.scheme}://{parsed.hostname}'
        except Exception:
            pass
        return 'http://localhost:5173'

    def open_web_login(self):
        url = f"{self._get_frontend_base()}/login"
        try:
            webbrowser.open(url)
        except Exception:
            messagebox.showerror('Error', f'Unable to open browser for {url}')

    def open_web_dashboard(self):
        if not self.token:
            return self.open_web_login()
        qs = urlencode({'token': self.token})
        url = f"{self._get_frontend_base()}/login?{qs}"
        try:
            webbrowser.open(url)
        except Exception:
            messagebox.showerror('Error', f'Unable to open browser for {url}')

    def start_tracking(self):
        self.tracking = True
        self._stop_event.clear()
        
        # UI Updates
        self.action_btn.configure(text="Stop Tracking", style='Danger.TButton')
        self.status_lbl.configure(text="Tracking Active", foreground=self.color_success)
        
        # Reset counters
        self.session_start_ts = time.time()
        self.total_idle_seconds = 0
        self.active_time_var.set("00:00:00")
        self.idle_time_var.set("00:00:00")
        
        # Start Threads
        self.tracker_thread = threading.Thread(target=self._tracking_loop, daemon=True)
        self.tracker_thread.start()
        
        self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self.heartbeat_thread.start()
        
        # Notify Backend
        try:
            headers = { 'Authorization': f'Bearer {self.token}' }
            requests.post(f'{self.backend_url}/api/work/start', headers=headers, timeout=10)
        except Exception as e:
            print('[work] start error:', e)

    def stop_tracking(self):
        if not self.tracking: return
        self.tracking = False
        self._stop_event.set()
        
        # UI Updates
        self.action_btn.configure(text="Start Tracking", style='Primary.TButton')
        self.status_lbl.configure(text="Online (Idle)", foreground=self.color_muted)
        self.capture_status_var.set("Session ended")
        
        # Live View Stop
        try:
            if self.live_view_active and self.sio:
                self.live_view_active = False
                self.sio.emit('live_view:terminate', {'employeeId': self.email.get()})
        except Exception:
            pass
        self._stop_live_loop()
        
        # Notify Backend
        try:
            headers = { 'Authorization': f'Bearer {self.token}' }
            requests.post(f'{self.backend_url}/api/work/stop', headers=headers, timeout=10)
        except Exception as e:
            print('[work] stop error:', e)

    def login(self):
        email = self.email.get().strip()
        password = self.password.get().strip()
        url = self.server_url.get().strip().rstrip('/')
        
        if not email or not password or not url:
            messagebox.showwarning('Missing', 'All fields are required.')
            return
        
        self.backend_url = url
        
        if not self._ensure_server():
            messagebox.showerror('Connection Error', f'Could not connect to {url}')
            return

        try:
            client_tz = self._detect_system_timezone()
            resp = requests.post(
                f'{self.backend_url}/api/auth/login',
                json={'email': email, 'password': password, 'role': 'employee', 'client_timezone': client_tz},
                timeout=10
            )
            
            if resp.status_code == 401:
                messagebox.showerror('Login Failed', 'Incorrect email or password.')
                return
            elif resp.status_code == 403:
                messagebox.showerror('Login Failed', 'Access denied. Role mismatch.')
                return
                
            resp.raise_for_status()
            data = resp.json()
            token = data.get('token')
            if not token:
                messagebox.showerror('Login Failed', 'Login succeeded but no token was returned by the server.')
                return
            effective_timezone = (data.get('user') or {}).get('timezone') or self._parse_jwt(token).get('timezone') or client_tz
        except requests.exceptions.ConnectionError:
            messagebox.showerror('Connection Error', 'Could not connect to the server. Please check your internet connection or server URL.')
            return
        except Exception as e:
            messagebox.showerror('Login Failed', f'An error occurred: {str(e)}')
            return

        # Check Role
        role = 'employee'
        try:
            payload = self._parse_jwt(token)
            role = payload.get('role') or 'employee'
        except: pass
        
        if role != 'employee':
            messagebox.showinfo('Access Denied', 'Desktop app is for employees only.')
            return

        def finalize_login():
            self.token = token
            self.effective_timezone = effective_timezone
            self._show_dashboard_frame()
            self._connect_socket(email)
            self._fetch_capture_interval()

        finalize_login()
        
        # Auto-start live view - REMOVED for on-demand only
        # self.live_view_active = True
        # self._start_live_loop()

    def request_time(self):
        if not self.token:
            messagebox.showerror('Error', 'Please login first')
            return
            
        win = tk.Toplevel(self.root)
        win.title("Request Missed Time")
        win.geometry("400x520")
        win.configure(bg=self.color_bg)
        win.resizable(False, False)
        
        # Header
        header = ttk.Frame(win, style='Surface.TFrame', padding=(20, 15))
        header.pack(fill='x')
        ttk.Label(header, text="Missed Time Request", style='Heading.TLabel', font=('Segoe UI', 14, 'bold')).pack(anchor='w')
        ttk.Label(header, text="Submit a request for manual approval", style='Muted.TLabel').pack(anchor='w')
        
        # Body
        body = ttk.Frame(win, padding=20)
        body.pack(fill='both', expand=True)
        
        # Styles
        style = ttk.Style()
        style.configure('Form.TLabel', background=self.color_bg, font=('Segoe UI', 9, 'bold'), foreground=self.color_text)
        
        # Date Picker
        ttk.Label(body, text="Date", style='Form.TLabel').pack(anchor='w', pady=(0, 5))
        date_entry = DateEntry(body, width=12, background=self.color_primary, foreground='white', borderwidth=0, font=('Segoe UI', 10))
        date_entry.pack(fill='x', pady=(0, 15), ipady=4)
        
        # Time Spinners
        time_frame = ttk.Frame(body)
        time_frame.pack(fill='x', pady=(0, 15))
        
        # Start Time
        start_col = ttk.Frame(time_frame)
        start_col.pack(side='left', fill='x', expand=True, padx=(0, 10))
        ttk.Label(start_col, text="Start Time", style='Form.TLabel').pack(anchor='w', pady=(0, 5))
        
        s_spin = ttk.Frame(start_col, style='Surface.TFrame')
        s_spin.pack(fill='x')
        
        def clamp_h(*_):
            val = start_h_var.get()
            if val.isdigit():
                v = int(val)
                if v > 23: start_h_var.set("23")
            elif val not in ('',):
                start_h_var.set("00")
        def clamp_m(*_):
            val = start_m_var.get()
            if val.isdigit():
                v = int(val)
                if v > 59: start_m_var.set("59")
            elif val not in ('',):
                start_m_var.set("00")
        
        start_h_var, start_m_var = tk.StringVar(value="09"), tk.StringVar(value="00")
        start_h_var.trace_add('write', clamp_h)
        start_m_var.trace_add('write', clamp_m)
        
        start_h_values = [f"{i:02d}" for i in range(24)]
        start_m_values = [f"{i:02d}" for i in range(60)]
        start_h = tk.Spinbox(s_spin, values=start_h_values, width=3, wrap=True, font=('Segoe UI', 11), relief='flat', bg='white',
                             textvariable=start_h_var)
        start_h.pack(side='left', fill='x', expand=True, padx=2, ipady=4)
        ttk.Label(s_spin, text=":", background='white', font=('Segoe UI', 11, 'bold')).pack(side='left')
        start_m = tk.Spinbox(s_spin, values=start_m_values, width=3, wrap=True, font=('Segoe UI', 11), relief='flat', bg='white',
                             textvariable=start_m_var)
        start_m.pack(side='left', fill='x', expand=True, padx=2, ipady=4)

        # End Time
        end_col = ttk.Frame(time_frame)
        end_col.pack(side='right', fill='x', expand=True)
        ttk.Label(end_col, text="End Time", style='Form.TLabel').pack(anchor='w', pady=(0, 5))
        
        e_spin = ttk.Frame(end_col, style='Surface.TFrame')
        e_spin.pack(fill='x')
        
        end_h_var, end_m_var = tk.StringVar(value="17"), tk.StringVar(value="00")
        
        def clamp_end_h(*_):
            val = end_h_var.get()
            if val.isdigit():
                v = int(val)
                if v > 23: end_h_var.set("23")
            elif val not in ('',):
                end_h_var.set("17")
        def clamp_end_m(*_):
            val = end_m_var.get()
            if val.isdigit():
                v = int(val)
                if v > 59: end_m_var.set("59")
            elif val not in ('',):
                end_m_var.set("00")
        end_h_var.trace_add('write', clamp_end_h)
        end_m_var.trace_add('write', clamp_end_m)
        
        end_h = tk.Spinbox(e_spin, values=[f"{i:02d}" for i in range(24)], width=3, wrap=True, font=('Segoe UI', 11), relief='flat', bg='white',
                           textvariable=end_h_var)
        end_h.pack(side='left', fill='x', expand=True, padx=2, ipady=4)
        ttk.Label(e_spin, text=":", background='white', font=('Segoe UI', 11, 'bold')).pack(side='left')
        end_m = tk.Spinbox(e_spin, values=[f"{i:02d}" for i in range(60)], width=3, wrap=True, font=('Segoe UI', 11), relief='flat', bg='white',
                           textvariable=end_m_var)
        end_m.pack(side='left', fill='x', expand=True, padx=2, ipady=4)
        
        # Reason
        ttk.Label(body, text="Reason", style='Form.TLabel').pack(anchor='w', pady=(0, 5))
        reason_entry = tk.Text(body, height=4, font=('Segoe UI', 10), bd=0, relief='flat', bg='white', highlightthickness=1, highlightbackground=self.color_border)
        reason_entry.pack(fill='x', pady=(0, 20), ipady=5)
        
        # Actions
        def submit():
            try:
                sh = int(start_h.get())
                sm = int(start_m.get())
                eh = int(end_h.get())
                em = int(end_m.get())
            except (ValueError, TypeError):
                messagebox.showerror('Error', 'Please enter valid numbers for start and end time.')
                return
            if not (0 <= sh <= 23 and 0 <= sm <= 59 and 0 <= eh <= 23 and 0 <= em <= 59):
                messagebox.showerror('Error', 'Time must be in 24-hour format (00-23 for hours, 00-59 for minutes).')
                return
            d = date_entry.get_date().strftime('%Y-%m-%d')
            s = f"{sh:02d}:{sm:02d}"
            e = f"{eh:02d}:{em:02d}"
            r = reason_entry.get("1.0", "end-1c")
            
            if not r.strip():
                messagebox.showerror('Error', 'Reason is required')
                return
                
            try:
                headers = {'Authorization': f'Bearer {self.token}'}
                resp = requests.post(f'{self.backend_url}/api/requests', json={
                    'date': d,
                    'start_time': s,
                    'end_time': e,
                    'reason': r,
                    'timezone': self.effective_timezone
                }, headers=headers)
                if resp.status_code == 200:
                    messagebox.showinfo('Success', 'Request submitted successfully')
                    win.destroy()
                else:
                    messagebox.showerror('Error', resp.json().get('error', 'Failed'))
            except Exception as ex:
                messagebox.showerror('Error', str(ex))
        
        btn_frame = ttk.Frame(body)
        btn_frame.pack(fill='x', side='bottom')
        ttk.Button(btn_frame, text="Cancel", style='Ghost.TButton', command=win.destroy).pack(side='left', expand=True, fill='x', padx=(0, 5))
        ttk.Button(btn_frame, text="Submit Request", style='Primary.TButton', command=submit).pack(side='right', expand=True, fill='x', padx=(5, 0))

    def logout(self):
        if self.tracking:
            self.stop_tracking()
        self.disable_live_view()
        if self.sio:
            try: self.sio.disconnect()
            except: pass
        self.token = None
        self._show_login_frame()

    # --- Core Logic ---

    def _connect_socket(self, email):
        try:
            self.sio = socketio.Client(reconnection=True)
            self.sio.on('live_view:initiate', self._on_live_view_start)
            self.sio.on('live_view:terminate', self._on_live_view_stop)
            self.sio.on('interval:assigned', self._on_interval_assigned)
            
            qs = urlencode({'userId': email})
            
            self.sio.connect(
                f"{self.backend_url}?{qs}", 
                auth={'token': self.token}, 
                transports=['websocket', 'polling'], 
                socketio_path='socket.io',
                wait=True,
                wait_timeout=10
            )
        except Exception as e:
            print('[socket] error:', e)

    def _fetch_capture_interval(self):
        try:
            headers = { 'Authorization': f'Bearer {self.token}' }
            resp = requests.get(f'{self.backend_url}/api/capture-interval', headers=headers, timeout=5)
            data = resp.json()
            secs = int(data.get('intervalSeconds') or 0)
            if data.get('assigned') and secs > 0:
                self.capture_interval_seconds = secs
        except Exception:
            pass

    def _on_interval_assigned(self, data=None):
        try:
            secs = int((data or {}).get('intervalSeconds') or 0)
            if secs > 0:
                self.capture_interval_seconds = secs
                if not self.tracking:
                    self.start_tracking()
        except: pass

    def _on_live_view_start(self, data=None):
        self.live_view_active = True
        self._start_live_loop()

    def _on_live_view_stop(self, data=None):
        self.live_view_active = False
        self._stop_live_loop()

    def _tracking_loop(self):
        next_capture = time.time() + self.capture_interval_seconds
        while not self._stop_event.is_set():
            now = time.time()
            elapsed = int(now - self.session_start_ts)
            self.active_time_var.set(self._format_hms(elapsed))
            
            remaining = int(next_capture - now)
            if remaining < 0: remaining = 0
            self.capture_status_var.set(f"Screenshot in {remaining}s")

            if now >= next_capture:
                try:
                    full, small = self._capture_screenshot()
                    self._upload_screenshot(full)
                    self._send_live_frame(small)
                except Exception as e:
                    print('[tracking] error:', e)
                next_capture = now + self.capture_interval_seconds
            
            time.sleep(0.5)

    def _capture_screenshot(self):
        with mss.mss() as sct:
            monitor = sct.monitors[1]
            img = sct.grab(monitor)
            pil_img = Image.frombytes('RGB', img.size, img.bgra, 'raw', 'BGRX')
            
            pil_small = pil_img.copy()
            pil_small.thumbnail((960, 540))

            buf = io.BytesIO()
            pil_img.save(buf, format='JPEG', quality=70)
            full = buf.getvalue()

            buf_small = io.BytesIO()
            pil_small.save(buf_small, format='JPEG', quality=60)
            small = buf_small.getvalue()
            return full, small

    def _upload_screenshot(self, jpeg_bytes):
        url = f'{self.backend_url}/api/uploads/drive'
        try:
            files = { 'screenshot': ('screenshot.jpg', jpeg_bytes, 'image/jpeg') }
            headers = { 'Authorization': f'Bearer {self.token}' }
            resp = requests.post(url, files=files, headers=headers, timeout=30)
            if resp.status_code == 200 or resp.status_code == 201:
                self.last_upload_var.set(self._format_hhmm_in_effective_tz(datetime.now(timezone.utc)))
                print(f'[upload] OK {len(jpeg_bytes)} bytes')
            else:
                print(f'[upload] HTTP {resp.status_code}: {resp.text[:200]}')
                self.last_upload_var.set(f"HTTP {resp.status_code}")
        except requests.exceptions.Timeout:
            print('[upload] TIMEOUT')
            self.last_upload_var.set("Timeout")
        except requests.exceptions.ConnectionError as e:
            print(f'[upload] CONNECTION ERROR: {e}')
            self.last_upload_var.set("No Connection")
        except Exception as e:
            print(f'[upload] ERROR: {e}')
            self.last_upload_var.set("Failed")

    def _detect_system_timezone(self):
        try:
            off = datetime.now().astimezone().utcoffset()
            if off is None:
                return 'UTC'
            mins = int(off.total_seconds() // 60)
            sign = '+' if mins >= 0 else '-'
            mins = abs(mins)
            return f"UTC{sign}{mins // 60:02d}:{mins % 60:02d}"
        except Exception:
            return 'UTC'

    def _format_hhmm_in_effective_tz(self, dt_utc):
        try:
            tz = str(self.effective_timezone or 'UTC').strip()
            if tz.upper() == 'UTC':
                return dt_utc.strftime('%H:%M')
            import re
            m = re.match(r'^UTC([+-])(\d{1,2})(?::(\d{2}))?$', tz.replace('−', '-').replace('–', '-').replace('—', '-'), re.I)
            if not m:
                return datetime.now().strftime('%H:%M')
            sign = 1 if m.group(1) == '+' else -1
            hh = int(m.group(2))
            mm = int(m.group(3) or 0)
            delta = timedelta(minutes=sign * (hh * 60 + mm))
            return (dt_utc + delta).strftime('%H:%M')
        except Exception:
            return datetime.now().strftime('%H:%M')

    def _send_live_frame(self, small_jpeg):
        if not self.sio or not self.sio.connected or not self.live_view_active: return
        try:
            b64 = base64.b64encode(small_jpeg).decode('ascii')
            self.sio.emit('live_view:frame', {'employeeId': self.email.get(), 'frameBase64': b64, 'ts': datetime.now(timezone.utc).isoformat()})
        except: pass

    def _start_live_loop(self):
        if self.live_thread and self.live_thread.is_alive(): return
        self._live_stop_event.clear()
        self.live_thread = threading.Thread(target=self._live_view_loop, daemon=True)
        self.live_thread.start()

    def _stop_live_loop(self):
        self._live_stop_event.set()

    def _live_view_loop(self):
        while not self._live_stop_event.is_set():
            if self.live_view_active:
                try:
                    _, small = self._capture_screenshot()
                    self._send_live_frame(small)
                except: pass
                time.sleep(LIVE_VIEW_INTERVAL_SECONDS)
            else:
                time.sleep(1)

    def _heartbeat_loop(self):
        prev_idle = 0
        while not self._stop_event.is_set():
            time.sleep(HEARTBEAT_INTERVAL_SECONDS)
            if self._stop_event.is_set(): break
            try:
                curr_idle = max(0, self._get_idle_seconds() - 180)
                delta = max(0, curr_idle - prev_idle) if curr_idle > 0 else 0
                if curr_idle == 0: prev_idle = 0
                else: prev_idle = curr_idle
                
                self.total_idle_seconds += delta
                self.idle_time_var.set(self._format_hms(self.total_idle_seconds))
                
                requests.post(f'{self.backend_url}/api/work/heartbeat', 
                    json={'idleDeltaSeconds': delta}, 
                    headers={'Authorization': f'Bearer {self.token}'}, timeout=5)
            except: pass

    def _get_idle_seconds(self):
        try:
            import ctypes
            class LASTINPUTINFO(ctypes.Structure):
                _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]
            lii = LASTINPUTINFO()
            lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
            if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii)): return 0
            millis = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
            return int(millis / 1000)
        except: return 0

    def _ensure_server(self):
        try: return requests.get(f'{self.backend_url}/health', timeout=2).ok
        except: return False

    def _parse_jwt(self, token):
        try:
            import json
            parts = token.split('.')
            b64 = parts[1].replace('-', '+').replace('_', '/')
            pad = '=' * (-len(b64) % 4)
            return json.loads(base64.b64decode(b64 + pad))
        except: return {}

    def _format_hms(self, s):
        h = s // 3600
        m = (s % 3600) // 60
        r = s % 60
        return f"{h:02}:{m:02}:{r:02}"

    def disable_live_view(self):
        self.live_view_active = False
        self._stop_live_loop()
        try: self.sio.emit('live_view:terminate', {'employeeId': self.email.get()})
        except: pass

    def _on_close(self):
        self.logout()
        try: self.root.destroy()
        except: os._exit(0)


def main():
    root = tk.Tk()
    app = TimeTrackerApp(root)
    root.mainloop()

if __name__ == '__main__':
    main()
