
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat } from '@google/genai';
import { marked } from 'marked';

const API_KEY = process.env.API_KEY;
const OS_NAME = "Wiqnnc_";
const OS_VERSION = "0.5 \"Photon\""; 

interface AppWindow {
  id: string; // Instance ID, e.g., Notepad-12345
  baseAppId: string; // Base app ID, e.g., Notepad
  element: HTMLElement;
  title: string;
  isMinimized: boolean;
  isOpen: boolean;
  zIndex: number;
  originalPosition?: { top: string; left: string; width: string; height: string };
  isMaximized?: boolean;
  isSnapping?: 'left' | 'right' | 'top' | null;
  appSpecificState?: any; 
  isShaking?: boolean; // For window shake secret
  lastDragTime?: number; // For window shake
  lastDragX?: number; // For window shake
}

interface NotepadState {
    currentContent: string;
    savedContentKey: string;
}
interface CalculatorState {
    currentValue: string;
    expression: string; // Store the full expression for eval
}
interface TerminalState {
    history: { type: 'input' | 'output' | 'error' | 'info' | 'success' | 'adventure' | 'ascii'; content: string }[];
    commandHistory: string[];
    historyIndex: number;
    adventureState?: AdventureState; // For text adventure
}
interface MusicPlayerState {
    tracks: { title: string, artist: string, duration: number }[]; // duration in seconds
    currentTrackIndex: number;
    isPlaying: boolean;
    currentTime: number; // in seconds
    playbackIntervalId?: number;
    volume: number; // 0-1
}
interface SystemMonitorState {
    cpuHistory: number[];
    memoryHistory: number[];
    updateIntervalId?: number;
}
interface MatrixRainState {
    animationFrameId?: number;
    canvasCtx?: CanvasRenderingContext2D;
    columns?: number;
    drops?: number[];
    fontSize?: number;
}
interface AdventureState {
    currentStep: string;
    inventory: string[];
}
interface WinsAssistantState {
    isLoading: boolean;
    // chatInstance is global for now
}
interface WBrowseState {
    history: string[]; // Stores URLs or "internal:home"
    currentIndex: number;
    iframeEl: HTMLIFrameElement | null;
    urlInputEl: HTMLInputElement | null;
    messageAreaEl: HTMLElement | null;
    currentLoadingUrl?: string; // URL attempted to load
    initialUrl?: string; // For opening W-Browse with a specific URL
}


interface AppDefinition {
  id: string; // Base App ID, e.g., "Portfolio", "Notepad"
  title: string;
  icon: string; // Emoji or class name for an icon
  contentTemplateId?: string; // ID of the <template> in HTML
  isPermanentDock?: boolean; // e.g., AppLibraryLauncher, Trash (Finder is handled by isFinderLike)
  isEssentialDock?: boolean; // e.g., Portfolio, Chat - always visible in a specific dock section
  isFinderLike?: boolean; // The "About" app acts as Finder, always first in dock
  isLaunchable?: boolean; // Can this be launched as an app (e.g., Trash is not launchable this way)
  defaultWidth?: string;
  defaultHeight?: string;
  appSpecificSetup?: (windowEl: HTMLElement, windowData: AppWindow) => void;
  category?: 'Productivity' | 'Creative' | 'Utilities' | 'System' | 'Portfolio' | 'Secret';
  allowMultipleInstances?: boolean;
}


const state = {
  windows: new Map<string, AppWindow>(),
  activeWindowId: null as string | null,
  nextZIndex: 100,
  isDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
  chatInstance: null as Chat | null, // This will be Win's Assistant instance
  konamiSequence: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'],
  konamiProgress: 0,
  appleLogoClicks: 0,
  appleLogoLastClickTime: 0,
  isFullScreen: !!document.fullscreenElement, // Initialize based on current state
  snapIndicator: null as HTMLElement | null,
  accentColors: ['#007AFF', '#FF9500', '#34C759', '#AF52DE', '#FF2D55'], // Blue, Orange, Green, Purple, Red
  currentAccentIndex: 0,
  dateTimeClickCount: 0,
  lastDateTimeClick: 0,
  isDockVisible: true,
  versionTooltipTimeout: null as number | null,
  isAppLibraryOpen: false,
};

// --- DOM Elements ---
const desktop = document.getElementById('desktop')!;
const windowsContainer = document.getElementById('windows-container')!;
const dock = document.getElementById('dock')!;
const menuBar = document.getElementById('menu-bar') as HTMLElement;
const menuBarAppTitle = document.getElementById('active-app-title') as HTMLElement;
const currentClock = document.getElementById('current-time')!;
const currentDateEl = document.getElementById('current-date')!;
const dateTimeEl = document.getElementById('date-time') as HTMLElement;
const contextMenu = document.getElementById('context-menu') as HTMLElement;
const bootScreen = document.getElementById('boot-screen') as HTMLElement;
const bootScreenMessage = bootScreen.querySelector('p') as HTMLElement;
const spotlightIcon = document.getElementById('spotlight-icon') as HTMLElement;
const spotlightSearchUI = document.getElementById('spotlight-search-ui') as HTMLElement;
const spotlightInput = document.getElementById('spotlight-input') as HTMLInputElement;
const spotlightResultsUl = document.getElementById('spotlight-results') as HTMLUListElement;

const imageModal = document.getElementById('image-modal') as HTMLElement;
const mediaModalMainTitleText = document.getElementById('image-modal-main-title-text') as HTMLElement;
const mediaModalIframeContainer = document.getElementById('media-modal-iframe-container') as HTMLElement;
const modalImageContent = document.getElementById('modal-image-content') as HTMLImageElement;

const konamiEffectDiv = document.getElementById('konami-code-effect') as HTMLElement;
const glitchOverlay = document.getElementById('glitch-overlay') as HTMLElement;
const versionTooltip = document.getElementById('version-tooltip') as HTMLElement;
const appLibraryOverlay = document.getElementById('app-library-overlay') as HTMLElement;
const appLibraryGrid = document.getElementById('app-library-grid') as HTMLElement;
const closeAppLibraryButton = document.getElementById('close-app-library-button') as HTMLElement;


const APP_DEFINITIONS: AppDefinition[] = [
  { id: 'About', title: 'About Me', icon: '👨‍💻', contentTemplateId: 'about-content', isFinderLike: true, isLaunchable: true, category: 'Portfolio', appSpecificSetup: setupAboutAppListeners },
  { id: 'AppLibraryLauncher', title: 'App Library', icon: '🚀', isPermanentDock: true, isLaunchable: false },
  { id: 'Portfolio', title: 'Portfolio', icon: '🖼️', contentTemplateId: 'portfolio-content', isLaunchable: true, category: 'Portfolio', appSpecificSetup: setupPortfolioAppListeners, isEssentialDock: true, defaultWidth: '700px', defaultHeight: '550px' },
  { id: 'WinsAssistant', title: "Win's Assistant", icon: '🎤', contentTemplateId: 'wins-assistant-content', isLaunchable: true, defaultWidth: '420px', defaultHeight: '550px', category: 'System', appSpecificSetup: setupWinsAssistantApp, isEssentialDock: true },
  { id: 'Settings', title: 'System Settings', icon: '⚙️', contentTemplateId: 'settings-content', isLaunchable: true, defaultWidth: '500px', defaultHeight: '480px', category: 'System', appSpecificSetup: setupSettingsAppListeners, isEssentialDock: true },
  { id: 'Terminal', title: 'Terminal', icon: '📟', contentTemplateId: 'terminal-content', isLaunchable: true, category: 'Utilities', appSpecificSetup: setupTerminalApp, isEssentialDock: true },
  { id: 'Notepad', title: 'Notepad', icon: '📝', contentTemplateId: 'notepad-content', isLaunchable: true, category: 'Productivity', appSpecificSetup: setupNotepadApp, allowMultipleInstances: true },
  { id: 'Calculator', title: 'Calculator', icon: '🧮', contentTemplateId: 'calculator-content', isLaunchable: true, defaultWidth: '320px', defaultHeight: '420px', category: 'Utilities', appSpecificSetup: setupCalculatorApp },
  { id: 'MusicPlayer', title: 'MiniTunes', icon: '🎶', contentTemplateId: 'musicplayer-content', isLaunchable: true, defaultWidth: '300px', defaultHeight: '320px', category: 'Creative', appSpecificSetup: setupMusicPlayerApp },
  { id: 'SystemMonitor', title: 'System Monitor', icon: '📊', contentTemplateId: 'systemmonitor-content', isLaunchable: true, defaultHeight: '380px', category: 'Utilities', appSpecificSetup: setupSystemMonitorApp },
  { id: 'WBrowse', title: 'W-Browse', icon: '🌐', contentTemplateId: 'w-browse-content', isLaunchable: true, defaultWidth: '800px', defaultHeight: '600px', category: 'Utilities', appSpecificSetup: setupWBrowseApp, allowMultipleInstances: true },
  { id: 'Achievements', title: 'Achievements', icon: '🏆', contentTemplateId: 'achievements-content', isLaunchable: true, category: 'Portfolio', defaultWidth: '550px' },
  { id: 'Contact', title: 'Contact', icon: '📧', contentTemplateId: 'contact-content', isLaunchable: true, category: 'Portfolio', appSpecificSetup: setupContactAppListeners },
  { id: 'Help', title: 'Wiqnnc_ Help', icon: '❓', contentTemplateId: 'help-content', isLaunchable: true, category: 'System' },
  { id: 'AboutWiqnnc', title: `About This ${OS_NAME}`, icon: '✨', contentTemplateId: 'about-this-wiqnnc-content', isLaunchable: true, category: 'System', appSpecificSetup: setupAboutWiqnncApp },
  { id: 'MatrixRain', title: 'Matrix Rain', icon: '🌌', contentTemplateId: 'matrix-rain-content', isLaunchable: true, defaultWidth: '700px', defaultHeight: '500px', category: 'Secret', appSpecificSetup: setupMatrixRainApp, allowMultipleInstances: true },
  { id: 'Credits', title: 'Wiqnnc_ Credits', icon: '📜', contentTemplateId: 'credits-content', isLaunchable: true, defaultWidth: '400px', defaultHeight: '450px', category: 'Secret', appSpecificSetup: setupCreditsApp, allowMultipleInstances: true },
  { id: 'Trash', title: 'Trash', icon: '🗑️', isPermanentDock: true, isLaunchable: false },
];


// --- Initialization ---
function init() {
  document.title = `${OS_NAME} - Kirati Rattanaporn`;
  bootScreenMessage.textContent = `Starting ${OS_NAME}...`;
  (bootScreen.querySelector('.boot-logo') as HTMLElement).textContent = OS_NAME.charAt(0).toUpperCase();

  document.documentElement.style.setProperty('--current-accent', state.accentColors[state.currentAccentIndex]);

  window.setTimeout(() => {
    bootScreen.classList.add('hidden');
    window.setTimeout(() => bootScreen.style.display = 'none', 500);
  }, 1500);

  updateDateTime();
  window.setInterval(updateDateTime, 1000 * 30); 

  applyTheme();
  renderDock(); 
  populateAppLibrary();
  setupDesktopContextMenu();
  setupMenuBar();
  setupSpotlight();
  setupGlobalKeyboardListeners();
  setupImageModalListeners(); 
  setupVersionClickPopups();
  setupDateTimeAccentCycler();
  setupFullscreenListener(); 
  closeAppLibraryButton.onclick = closeAppLibrary;
  appLibraryOverlay.addEventListener('click', (e) => { if(e.target === appLibraryOverlay) closeAppLibrary(); });


  if (!API_KEY) {
    console.warn(`${OS_NAME} Assistant API key is missing. Assistant functionality will be limited.`);
    const errorAppDef = APP_DEFINITIONS.find(app => app.id === 'WinsAssistant');
    createWindow({
        baseAppId: 'ErrorApiKey', 
        title: 'API Key Error', 
        htmlContent: `<p style="padding:15px;text-align:center;">AI Assistant API Key is not configured. "${errorAppDef?.title || 'Win\'s Assistant'}" will not function correctly.</p>`, 
        x: 100, y: 100, width:'350px', height:'180px'});
  } else {
    initializeGeminiChat(); // For Win's Assistant
  }
  // Open "About" app (Finder) on startup after a slight delay
  window.setTimeout(() => openApp('About'), 2000);
}

// --- Theme Management ---
function applyTheme() {
  document.body.classList.toggle('dark-theme', state.isDarkMode);
  localStorage.setItem('wiqnnc-theme', state.isDarkMode ? 'dark' : 'light');
    state.windows.forEach(win => {
        if (win.baseAppId === 'Terminal' && win.element.querySelector('.neofetch-output')) {
            const termThemeInfo = win.element.querySelector('#term-theme-info');
            if (termThemeInfo) termThemeInfo.textContent = state.isDarkMode ? 'Dark' : 'Light';
        }
    });
}

function toggleTheme() {
  state.isDarkMode = !state.isDarkMode;
  applyTheme();
}
const savedTheme = localStorage.getItem('wiqnnc-theme');
if (savedTheme) state.isDarkMode = savedTheme === 'dark';


// --- Date & Time & Accent Cycler ---
function updateDateTime() {
  const now = new Date();
  currentClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  currentDateEl.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
function setupDateTimeAccentCycler() {
    dateTimeEl.addEventListener('click', () => {
        const now = Date.now();
        if (now - state.lastDateTimeClick < 300) { 
            state.dateTimeClickCount++;
        } else {
            state.dateTimeClickCount = 1;
        }
        state.lastDateTimeClick = now;

        if (state.dateTimeClickCount >= 3) {
            state.currentAccentIndex = (state.currentAccentIndex + 1) % state.accentColors.length;
            document.documentElement.style.setProperty('--current-accent', state.accentColors[state.currentAccentIndex]);
            state.dateTimeClickCount = 0; 
            state.windows.forEach(win => {
                if (win.baseAppId === 'Terminal' && win.element.querySelector('.neofetch-output')) {
                    const neofetchAscii = win.element.querySelector('.neofetch-ascii') as HTMLElement;
                    const neofetchLabels = win.element.querySelectorAll('.neofetch-line > span:first-child') as NodeListOf<HTMLElement>;
                    if (neofetchAscii) neofetchAscii.style.color = state.accentColors[state.currentAccentIndex];
                    neofetchLabels.forEach(label => label.style.color = state.accentColors[state.currentAccentIndex]);
                }
            });
        }
    });
}


// --- Window Management ---
function createWindow(options: {baseAppId: string; title: string; htmlContent?: string; x?: number; y?: number; width?: string; height?: string; appSpecificSetupOverride?: (windowEl: HTMLElement, windowData: AppWindow) => void; appSpecificStateOverride?: any }): AppWindow | null {
  const appDef = APP_DEFINITIONS.find(app => app.id === options.baseAppId);
  
  const isSpecialCase = ['ErrorApiKey', 'TrashMessage'].includes(options.baseAppId);
  if (!appDef && !isSpecialCase) {
      console.error(`App definition not found for ${options.baseAppId}`);
      return null;
  }

  if (!appDef?.allowMultipleInstances && Array.from(state.windows.values()).some(win => win.baseAppId === options.baseAppId && win.isOpen)) {
    const existingWindow = Array.from(state.windows.values()).find(win => win.baseAppId === options.baseAppId && win.isOpen)!;
    if (existingWindow.isMinimized) restoreWindow(existingWindow.id);
    focusWindow(existingWindow.id);
    return existingWindow;
  }

  const template = document.getElementById('window-template') as HTMLTemplateElement;
  const windowEl = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
  
  const windowId = `${options.baseAppId}-${Date.now()}`;
  windowEl.dataset.id = windowId;
  windowEl.dataset.baseAppId = options.baseAppId;
  (windowEl.querySelector('.window-title-text') as HTMLElement).textContent = options.title;
  const windowBody = windowEl.querySelector('.window-body') as HTMLElement;
  
  const contentTemplateElForCreate = appDef?.contentTemplateId ? document.getElementById(appDef.contentTemplateId) as HTMLTemplateElement : null;
  if(options.htmlContent) {
      windowBody.innerHTML = options.htmlContent;
  } else if (contentTemplateElForCreate) {
      windowBody.innerHTML = contentTemplateElForCreate.innerHTML;
  } else if (isSpecialCase) {
      windowBody.innerHTML = options.htmlContent || `<p style="padding:15px;text-align:center;">Special System Message.</p>`; 
  } else {
      windowBody.innerHTML = `<p>${appDef?.title || options.title} content goes here.</p>`;
  }


  windowEl.style.left = `${options.x ?? Math.random() * (desktop.clientWidth - (parseInt(options.width || appDef?.defaultWidth || '350') )) * 0.7 + 20}px`;
  windowEl.style.top = `${options.y ?? Math.random() * (desktop.clientHeight - (parseInt(options.height || appDef?.defaultHeight || '450')) - 70 - 30) * 0.7 + 30}px`; 
  if(options.width || appDef?.defaultWidth) windowEl.style.width = options.width || appDef?.defaultWidth!;
  if(options.height || appDef?.defaultHeight) windowEl.style.height = options.height || appDef?.defaultHeight!;
  
  windowsContainer.appendChild(windowEl);

  const newWindow: AppWindow = {
    id: windowId,
    baseAppId: options.baseAppId,
    element: windowEl,
    title: options.title,
    isMinimized: false,
    isOpen: true,
    zIndex: state.nextZIndex++,
    appSpecificState: options.appSpecificStateOverride || undefined,
  };
  state.windows.set(windowId, newWindow);
  
  makeDraggable(windowEl.querySelector('.title-bar') as HTMLElement, windowEl);
  makeResizable(windowEl);
  setupWindowControls(newWindow);
  
  windowEl.addEventListener('mousedown', () => focusWindow(windowId), true); 
  
  window.setTimeout(() => windowEl.classList.add('open'), 10); 

  focusWindow(windowId); 

  const setupFn = options.appSpecificSetupOverride || appDef?.appSpecificSetup;
  if (setupFn) {
    setupFn(windowEl, newWindow);
  }
  updateWindowMenu();
  updateSystemMonitorProcessList();
  return newWindow;
}

function focusWindow(id: string | null) {
  if (!id || !state.windows.has(id)) {
    state.activeWindowId = null;
    menuBarAppTitle.textContent = 'Finder'; 
    updateMenuBarForApp(null);
    renderDock(); 
    return;
  }

  const windowData = state.windows.get(id)!;
  if (state.activeWindowId === id && windowData.zIndex === state.nextZIndex -1 && !windowData.isMinimized) return;

  state.activeWindowId = id;
  windowData.zIndex = state.nextZIndex++;
  windowData.element.style.zIndex = windowData.zIndex.toString();

  state.windows.forEach(win => win.element.classList.remove('focused'));
  windowData.element.classList.add('focused');
  
  const appDef = APP_DEFINITIONS.find(app => app.id === windowData.baseAppId);
  menuBarAppTitle.textContent = appDef?.title || windowData.title;
  updateMenuBarForApp(id);
  renderDock(); 
}


function closeWindow(id: string) {
  const windowData = state.windows.get(id);
  if (windowData) {
    windowData.isOpen = false; 
    windowData.element.classList.remove('open');
    windowData.element.classList.add('closing'); 
    if (windowData.appSpecificState) {
        if (windowData.appSpecificState.playbackIntervalId) window.clearInterval(windowData.appSpecificState.playbackIntervalId);
        if (windowData.appSpecificState.updateIntervalId) window.clearInterval(windowData.appSpecificState.updateIntervalId);
        if (windowData.appSpecificState.animationFrameId) cancelAnimationFrame(windowData.appSpecificState.animationFrameId);
    }

    window.setTimeout(() => {
        windowData.element.remove();
        state.windows.delete(id); 
        if (state.activeWindowId === id) {
          focusWindow(null); 
        }
        renderDock();
        updateWindowMenu();
        updateSystemMonitorProcessList();
    }, 200); 
  }
}

function minimizeWindow(id: string) {
  const windowData = state.windows.get(id);
  if (windowData && !windowData.isMinimized) {
    windowData.originalPosition = { 
      top: windowData.element.style.top, left: windowData.element.style.left,
      width: windowData.element.style.width, height: windowData.element.style.height,
    };
    windowData.element.classList.remove('maximized'); 
    windowData.isMaximized = false;
    windowData.element.classList.add('minimized');
    windowData.isMinimized = true;
    if (state.activeWindowId === id) {
      focusWindow(null);
    }
    updateWindowMenu();
    renderDock(); 
  }
}

function restoreWindow(id: string) {
  const windowData = state.windows.get(id);
  if (windowData && windowData.isMinimized) {
    windowData.element.classList.remove('minimized');
     if(windowData.originalPosition) {
        windowData.element.style.top = windowData.originalPosition.top;
        windowData.element.style.left = windowData.originalPosition.left;
        windowData.element.style.width = windowData.originalPosition.width;
        windowData.element.style.height = windowData.originalPosition.height;
     }
    windowData.isMinimized = false;
    focusWindow(id);
    updateWindowMenu();
  } else if (windowData && !windowData.isOpen) { 
     openApp(windowData.baseAppId); 
  } else if (windowData) { 
    focusWindow(id);
  }
}

function toggleMaximizeWindow(id: string) {
    const windowData = state.windows.get(id);
    if (windowData) {
        if (windowData.isMaximized) { 
            windowData.element.classList.remove('maximized');
            if (windowData.originalPosition) {
                windowData.element.style.top = windowData.originalPosition.top;
                windowData.element.style.left = windowData.originalPosition.left;
                windowData.element.style.width = windowData.originalPosition.width;
                windowData.element.style.height = windowData.originalPosition.height;
            }
            windowData.isMaximized = false;
        } else { 
            windowData.originalPosition = {
                top: windowData.element.style.top, left: windowData.element.style.left,
                width: windowData.element.style.width, height: windowData.element.style.height,
            };
            windowData.element.classList.add('maximized');
            windowData.isMaximized = true;
        }
        windowData.element.style.transition = 'top 0.2s ease-out, left 0.2s ease-out, width 0.2s ease-out, height 0.2s ease-out';
        window.setTimeout(() => windowData.element.style.transition = '', 200); 
    }
}


function setupWindowControls(windowData: AppWindow) {
  const closeBtn = windowData.element.querySelector('.window-control.close') as HTMLElement;
  const minimizeBtn = windowData.element.querySelector('.window-control.minimize') as HTMLElement;
  const maximizeBtn = windowData.element.querySelector('.window-control.maximize') as HTMLElement;

  closeBtn.onclick = (e) => { e.stopPropagation(); closeWindow(windowData.id); };
  minimizeBtn.onclick = (e) => { e.stopPropagation(); minimizeWindow(windowData.id); };
  maximizeBtn.onclick = (e) => { e.stopPropagation(); toggleMaximizeWindow(windowData.id); };
}

function makeDraggable(titleBar: HTMLElement, windowEl: HTMLElement) {
  let offsetX: number, offsetY: number;

  titleBar.onmousedown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-control')) return; 
    e.preventDefault();
    document.body.classList.add('grabbing');
    windowEl.classList.add('is-dragging');

    const windowId = windowEl.dataset.id;
    const windowData = windowId ? state.windows.get(windowId) : null;
    if (windowData && windowData.id !== state.activeWindowId) {
        focusWindow(windowData.id); 
    }
    
    if (windowData && windowData.isMaximized) return; 

    offsetX = e.clientX - windowEl.offsetLeft;
    offsetY = e.clientY - windowEl.offsetTop;

    if(windowData) {
        windowData.lastDragTime = Date.now();
        windowData.lastDragX = windowEl.offsetLeft;
    }

    if (!state.snapIndicator) {
        state.snapIndicator = document.createElement('div');
        state.snapIndicator.className = 'snap-indicator';
        desktop.appendChild(state.snapIndicator);
    }
    state.snapIndicator.style.display = 'none'; 

    document.onmousemove = (moveEvent: MouseEvent) => {
      let newX = moveEvent.clientX - offsetX;
      let newY = moveEvent.clientY - offsetY;

      const menuBarHeight = 28;
      const dockHeight = state.isDockVisible ? 70 : 0;
      newX = Math.max(0, Math.min(newX, desktop.clientWidth - windowEl.offsetWidth));
      newY = Math.max(menuBarHeight, Math.min(newY, desktop.clientHeight - windowEl.offsetHeight - dockHeight));
      
      windowEl.style.left = `${newX}px`;
      windowEl.style.top = `${newY}px`;

      if (windowData && !windowData.isShaking && windowData.lastDragTime && windowData.lastDragX !== undefined) {
          const currentTime = Date.now();
          const deltaX = Math.abs(newX - windowData.lastDragX);
          const deltaTime = currentTime - windowData.lastDragTime;

          if (deltaTime < 100 && deltaX > 15 && deltaX < 50) { 
              windowData.isShaking = true;
              windowEl.classList.add('shaking');
              window.setTimeout(() => {
                  windowEl.classList.remove('shaking');
                  if(windowData) windowData.isShaking = false;
              }, 300); 
          }
          windowData.lastDragTime = currentTime;
          windowData.lastDragX = newX;
      }

      const snapThreshold = 20;
      const pointerX = moveEvent.clientX;
      const pointerY = moveEvent.clientY;

      if (pointerX < snapThreshold) { showSnapIndicator('left', menuBarHeight); }
      else if (pointerX > desktop.clientWidth - snapThreshold) { showSnapIndicator('right', menuBarHeight); }
      else if (pointerY < menuBarHeight + snapThreshold) { showSnapIndicator('top', menuBarHeight); }
      else {
          if(state.snapIndicator) state.snapIndicator.style.display = 'none';
          if (windowData) windowData.isSnapping = null;
      }
    };

    document.onmouseup = () => {
      document.body.classList.remove('grabbing');
      windowEl.classList.remove('is-dragging');
      document.onmousemove = null;
      document.onmouseup = null;

      if(state.snapIndicator) state.snapIndicator.style.display = 'none';
      if (windowData && windowData.isSnapping) {
          applySnap(windowData);
      }
    };
  };
}

function showSnapIndicator(position: 'left' | 'right' | 'top', menuBarHeight: number) {
    if (!state.snapIndicator) return;
    const halfWidth = desktop.clientWidth / 2 - 5; 
    const fullWidth = desktop.clientWidth - 10;
    const halfHeight = (desktop.clientHeight - menuBarHeight - (state.isDockVisible ? 70 : 0)) / 2 -5 ; 

    state.snapIndicator.style.display = 'block';
    state.snapIndicator.style.top = `${menuBarHeight + 5}px`;
    
    const activeWindow = state.activeWindowId ? state.windows.get(state.activeWindowId) : null;
    if (activeWindow) activeWindow.isSnapping = position;

    switch (position) {
        case 'left':
            state.snapIndicator.style.left = '5px';
            state.snapIndicator.style.width = `${halfWidth}px`;
            state.snapIndicator.style.height = `calc(100% - ${menuBarHeight + (state.isDockVisible ? 70 : 0) + 10}px)`;
            break;
        case 'right':
            state.snapIndicator.style.left = `${desktop.clientWidth / 2 + 5}px`;
            state.snapIndicator.style.width = `${halfWidth}px`;
            state.snapIndicator.style.height = `calc(100% - ${menuBarHeight + (state.isDockVisible ? 70 : 0) + 10}px)`;
            break;
        case 'top': 
            state.snapIndicator.style.left = '5px';
            state.snapIndicator.style.width = `${fullWidth}px`;
            state.snapIndicator.style.height = `${halfHeight}px`;
            break;
    }
}

function applySnap(windowData: AppWindow) {
    if (!windowData.isSnapping) return;

    const menuBarHeight = 28;
    const dockTotalHeight = state.isDockVisible ? 70 : 0;
    const windowEl = windowData.element;
    windowData.isMaximized = false; 
    windowEl.classList.remove('maximized');

    windowEl.style.transition = 'top 0.15s ease-out, left 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out';

    switch (windowData.isSnapping) {
        case 'left':
            windowEl.style.top = `${menuBarHeight + 2}px`;
            windowEl.style.left = `2px`;
            windowEl.style.width = `calc(50vw - 4px)`;
            windowEl.style.height = `calc(100vh - ${menuBarHeight + dockTotalHeight + 4}px)`;
            break;
        case 'right':
            windowEl.style.top = `${menuBarHeight + 2}px`;
            windowEl.style.left = `calc(50vw + 2px)`;
            windowEl.style.width = `calc(50vw - 4px)`;
            windowEl.style.height = `calc(100vh - ${menuBarHeight + dockTotalHeight + 4}px)`;
            break;
        case 'top':
            windowEl.style.top = `${menuBarHeight + 2}px`;
            windowEl.style.left = `2px`;
            windowEl.style.width = `calc(100vw - 4px)`;
            windowEl.style.height = `calc(50vh - ${menuBarHeight/2 + dockTotalHeight/2 + 2}px)`; 
            break;
    }
    windowData.isSnapping = null; 
    window.setTimeout(() => windowEl.style.transition = '', 150); 
}


function makeResizable(windowEl: HTMLElement) {
    const resizeHandle = windowEl.querySelector('.resize-handle') as HTMLElement;
    let startX: number, startY: number, startWidth: number, startHeight: number;

    resizeHandle.onmousedown = (e: MouseEvent) => {
        e.preventDefault(); e.stopPropagation(); 
        const windowData = state.windows.get(windowEl.dataset.id!);
        if (windowData && (windowData.isMaximized || windowData.isSnapping)) return; 

        startX = e.clientX; startY = e.clientY;
        startWidth = parseInt(document.defaultView!.getComputedStyle(windowEl).width, 10);
        startHeight = parseInt(document.defaultView!.getComputedStyle(windowEl).height, 10);
        document.body.style.cursor = 'nwse-resize';

        document.onmousemove = (moveEvent: MouseEvent) => {
            const newWidth = startWidth + (moveEvent.clientX - startX);
            const newHeight = startHeight + (moveEvent.clientY - startY);
            windowEl.style.width = `${Math.max(300, newWidth)}px`; 
            windowEl.style.height = `${Math.max(200, newHeight)}px`; 
        };
        document.onmouseup = () => {
            document.onmousemove = null; document.onmouseup = null;
            document.body.style.cursor = 'default';
        };
    };
}


// --- Dock Management ---
function createDockItem(appDef: AppDefinition): HTMLElement {
    const item = document.createElement('div');
    item.className = 'dock-item';
    item.setAttribute('data-app', appDef.id);
    item.setAttribute('aria-label', appDef.title);
    item.setAttribute('role', 'button');
    item.tabIndex = 0; // Make it focusable

    const iconDiv = document.createElement('div');
    iconDiv.className = 'app-icon';
    iconDiv.textContent = appDef.icon;
    item.appendChild(iconDiv);

    const tooltip = document.createElement('span');
    tooltip.className = 'tooltip';
    tooltip.textContent = appDef.title;
    item.appendChild(tooltip);
    
    setupDockItemInteractions(item, appDef);
    return item;
}

function setupDockItemInteractions(item: HTMLElement, appDef: AppDefinition) {
    const performAction = () => {
        if (appDef.id === "AppLibraryLauncher") {
            toggleAppLibrary();
        } else if (appDef.id === "Trash") {
             createWindow({
                baseAppId: 'TrashMessage', 
                title: 'Trash', 
                htmlContent: `<div style="text-align:center; padding: 20px;">
                            <p>Trash is currently empty. Very tidy!</p>
                            <button id="empty-trash-btn-mock" style="padding: 5px 10px; margin-top:10px; border-radius:5px; border:1px solid var(--current-border-color); background: var(--current-button-bg); cursor:pointer;">Empty Trash (Mock)</button>
                          </div>`, 
                width:'300px', height:'180px', 
                x: window.innerWidth/2 - 150, y: window.innerHeight/2 - 90,
                appSpecificSetupOverride: (winEl) => {
                    const btn = winEl.querySelector('#empty-trash-btn-mock');
                    if(btn) btn.addEventListener('click', () => alert("Woosh! Even more empty now! (This is a mock action)"));
                }
            });
            return;
        } else { 
            openApp(appDef.id);
        }
        
        const iconEl = item.querySelector('.app-icon');
        if (iconEl) {
            item.classList.add('bouncing'); 
            window.setTimeout(() => item.classList.remove('bouncing'), 500);
        }
    };

    item.addEventListener('click', performAction);
    item.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            performAction();
        }
    });


    item.addEventListener('mousemove', (e: MouseEvent) => {
        const itemRect = item.getBoundingClientRect();
        const xInItem = e.clientX - itemRect.left;
        const proximityFactor = Math.max(0, 1 - (Math.abs(xInItem - itemRect.width / 2) / (itemRect.width))); 

        const mainScale = 1 + (1.8 - 1) * proximityFactor;
        const mainRise = -18 * proximityFactor; 
        const mainPushSelf = 0; 

        (item.querySelector('.app-icon') as HTMLElement).style.transform = `translateY(${mainRise}px) scale(${mainScale})`;
        item.style.transform = `translateX(${mainPushSelf}px)`;
        item.style.zIndex = '20';

        const neighborIconScaleBase = 1.0;
        const neighborIconScaleEffect = 0.4 * proximityFactor; 
        const neighborRiseBase = 0;
        const neighborRiseEffect = -10 * proximityFactor; 
        const neighborPushAmount = 20 * proximityFactor; 

        const allItems = Array.from(dock.querySelectorAll('.dock-item')) as HTMLElement[];
        allItems.forEach(otherItem => {
            if (otherItem !== item && otherItem !== item.previousElementSibling && otherItem !== item.nextElementSibling) {
                (otherItem.querySelector('.app-icon') as HTMLElement).style.transform = 'translateY(0px) scale(1)';
                otherItem.style.transform = 'translateX(0px)';
                otherItem.style.zIndex = '1';
            }
        });
        
        const prev = item.previousElementSibling as HTMLElement;
        if (prev && prev.classList.contains('dock-item')) {
            const prevIcon = prev.querySelector('.app-icon') as HTMLElement;
            const prevProximity = Math.max(0, 1 - (xInItem / itemRect.width)) * proximityFactor; 
            const actualPrevScale = neighborIconScaleBase + neighborIconScaleEffect * prevProximity;
            const actualPrevRise = neighborRiseBase + neighborRiseEffect * prevProximity;
            const actualPrevPush = neighborPushAmount * prevProximity;

            prevIcon.style.transform = `translateY(${actualPrevRise}px) scale(${actualPrevScale})`;
            prev.style.transform = `translateX(${-actualPrevPush}px)`;
            prev.style.zIndex = '10';
        }

        const next = item.nextElementSibling as HTMLElement;
        if (next && next.classList.contains('dock-item')) {
            const nextIcon = next.querySelector('.app-icon') as HTMLElement;
            const nextProximity = Math.max(0, ((xInItem - itemRect.width / 2) / (itemRect.width / 2))) * proximityFactor; 
            const actualNextScale = neighborIconScaleBase + neighborIconScaleEffect * nextProximity;
            const actualNextRise = neighborRiseBase + neighborRiseEffect * nextProximity;
            const actualNextPush = neighborPushAmount * nextProximity;
            
            nextIcon.style.transform = `translateY(${actualNextRise}px) scale(${actualNextScale})`;
            next.style.transform = `translateX(${actualNextPush}px)`;
            next.style.zIndex = '10';
        }
    });

    item.addEventListener('mouseleave', () => {
        (item.querySelector('.app-icon') as HTMLElement).style.transform = 'translateY(0px) scale(1)';
        item.style.transform = 'translateX(0px)';
        item.style.zIndex = '1';

        const prev = item.previousElementSibling as HTMLElement;
        if (prev && prev.classList.contains('dock-item')) {
            (prev.querySelector('.app-icon') as HTMLElement).style.transform = 'translateY(0px) scale(1)';
            prev.style.transform = 'translateX(0px)';
            prev.style.zIndex = '1';
        }
        const next = item.nextElementSibling as HTMLElement;
        if (next && next.classList.contains('dock-item')) {
            (next.querySelector('.app-icon') as HTMLElement).style.transform = 'translateY(0px) scale(1)';
            next.style.transform = 'translateX(0px)';
            next.style.zIndex = '1';
        }
    });
}


function renderDock() {
    const finderContainer = dock.querySelector('#dock-permanent-finder-container') as HTMLElement;
    const essentialContainer = dock.querySelector('#dock-essential-items-container') as HTMLElement;
    const separator1 = dock.querySelector('#dock-separator-1') as HTMLElement;
    const dynamicContainer = dock.querySelector('#dock-dynamic-items-container') as HTMLElement;
    const separator2 = dock.querySelector('#dock-separator-2') as HTMLElement;
    const systemContainer = dock.querySelector('#dock-permanent-system-container') as HTMLElement;

    finderContainer.innerHTML = '';
    essentialContainer.innerHTML = '';
    dynamicContainer.innerHTML = '';
    systemContainer.innerHTML = '';


    const finderAppDef = APP_DEFINITIONS.find(app => app.isFinderLike);
    if (finderAppDef) finderContainer.appendChild(createDockItem(finderAppDef));

    APP_DEFINITIONS.forEach(appDef => {
        if (appDef.isEssentialDock) {
            essentialContainer.appendChild(createDockItem(appDef));
        }
    });

    const runningAppBaseIds = new Set<string>();
    state.windows.forEach(win => {
        if (win.isOpen) runningAppBaseIds.add(win.baseAppId);
    });

    let dynamicAppsRendered = false;
    APP_DEFINITIONS.forEach(appDef => {
        if (runningAppBaseIds.has(appDef.id) && 
            !appDef.isFinderLike && 
            !appDef.isEssentialDock && 
            !appDef.isPermanentDock && 
            appDef.isLaunchable) {
            dynamicContainer.appendChild(createDockItem(appDef));
            dynamicAppsRendered = true;
        }
    });
    
    const hasEssentialApps = APP_DEFINITIONS.some(app => app.isEssentialDock);
    const hasSystemItems = APP_DEFINITIONS.some(app => app.isPermanentDock); 

    // Default state: hide separators
    separator1.style.display = 'none';
    separator2.style.display = 'none';

    const hasFinder = !!finderAppDef;
    const hasEssentials = essentialContainer.children.length > 0;
    const hasDynamics = dynamicContainer.children.length > 0;
    const hasSystems = systemContainer.children.length > 0; // Will be true due to AppLib and Trash


    if (hasFinder && (hasEssentials || hasDynamics || hasSystems)) {
        if (hasEssentials || hasDynamics) separator1.style.display = 'block';
        else if (hasSystems) separator1.style.display = 'block'; // Finder -> Separator -> Systems
    } else if (hasEssentials && (hasDynamics || hasSystems)) {
         separator1.style.display = 'block'; // Essentials -> Separator -> Dynamic/Systems
    }


    if (hasDynamics && hasSystems) {
        separator2.style.display = 'block'; // Dynamic -> Separator -> Systems
    } else if (!hasDynamics && (hasFinder || hasEssentials) && hasSystems) {
        // If no dynamic apps, but we have (Finder or Essentials) AND Systems,
        // then separator1 might be visible already. Separator2 only if dynamic exists.
        // If there are essentials and systems, but no dynamics, sep1 is enough.
        // If there's finder and systems, but no essentials and no dynamics, sep1 is enough.
        // This means separator2 is ONLY for when dynamic apps exist before system apps.
    }


    const appLibDef = APP_DEFINITIONS.find(app => app.id === 'AppLibraryLauncher' && app.isPermanentDock);
    if (appLibDef) systemContainer.appendChild(createDockItem(appLibDef));
    
    const trashAppDef = APP_DEFINITIONS.find(app => app.id === 'Trash' && app.isPermanentDock);
    if (trashAppDef) systemContainer.appendChild(createDockItem(trashAppDef));

    updateAllDockActiveStates();
}

function updateAllDockActiveStates() {
    const allDockItems = dock.querySelectorAll('.dock-item');
    allDockItems.forEach(itemEl => {
        const item = itemEl as HTMLElement;
        const appId = item.getAttribute('data-app');
        if (appId) {
            const isAppRunningOrEssential = Array.from(state.windows.values()).some(win => win.baseAppId === appId && win.isOpen && !win.isMinimized);
            const isActiveFocus = state.activeWindowId && state.windows.get(state.activeWindowId)?.baseAppId === appId && !state.windows.get(state.activeWindowId)?.isMinimized;
            
            const appDef = APP_DEFINITIONS.find(app => app.id === appId);
            let showDot = (appDef?.isFinderLike || appDef?.isEssentialDock) ?
                           isActiveFocus || isAppRunningOrEssential : 
                           isAppRunningOrEssential; 

            const anyInstanceOpen = Array.from(state.windows.values()).some(win => win.baseAppId === appId && win.isOpen);
            if (!isActiveFocus && Array.from(state.windows.values()).filter(win=>win.baseAppId === appId && win.isOpen).every(win => win.isMinimized) && anyInstanceOpen) {
                 showDot = true;
            }
            item.classList.toggle('active-app', showDot || isActiveFocus);
        }
    });
}


function openApp(appId: string, options?: { initialUrl?: string }) {
  const appDef = APP_DEFINITIONS.find(app => app.id === appId);
  if (!appDef || !appDef.isLaunchable) {
    console.warn(`App ${appId} is not launchable or not defined.`);
    return;
  }

  const existingWindowsOfApp = Array.from(state.windows.values()).filter(win => win.baseAppId === appId && win.isOpen);
  if (!appDef.allowMultipleInstances && existingWindowsOfApp.length > 0) {
    const existingWindow = existingWindowsOfApp[0];
     if (options?.initialUrl && existingWindow.baseAppId === 'WBrowse' && existingWindow.appSpecificState) {
        (existingWindow.appSpecificState as WBrowseState).initialUrl = options.initialUrl; 
        const setupFn = appDef.appSpecificSetup; // Re-call setup to handle potential URL change
        if (setupFn && (existingWindow.appSpecificState as WBrowseState).iframeEl) { // Check if iframe is ready
             navigateToUrlInWBrowse(existingWindow, options.initialUrl); // Directly navigate
        } else {
            // If iframe not ready, store for setup. This scenario needs careful handling if initialUrl is critical on focus.
        }
    }
    restoreWindow(existingWindow.id); 
    return;
  }
  
  const contentTemplateEl = appDef.contentTemplateId ? document.getElementById(appDef.contentTemplateId) as HTMLTemplateElement : null;
  if (!contentTemplateEl && appDef.contentTemplateId) {
      console.error(`Content template ${appDef.contentTemplateId} not found for app ${appId}`);
      createWindow({ 
        baseAppId: appId, 
        title: appDef.title, 
        htmlContent: `<p style="color:red;padding:15px;">Error: Content template '${appDef.contentTemplateId}' missing for ${appDef.title}.</p>`,
        x: Math.random() * 200 + 50 + (state.windows.size * 25 % 250),
        y: Math.random() * 100 + 50 + (state.windows.size * 25 % 150),
        width: appDef.defaultWidth || '400px',
        height: appDef.defaultHeight || '300px',
      });
      return;
  }
  const appSpecificState = options?.initialUrl && appId === 'WBrowse' ? { initialUrl: options.initialUrl } : undefined;

  createWindow({ 
    baseAppId: appId, 
    title: appDef.title, 
    x: Math.random() * 200 + 50 + (state.windows.size * 25 % 250),
    y: Math.random() * 100 + 50 + (state.windows.size * 25 % 150),
    width: appDef.defaultWidth,
    height: appDef.defaultHeight,
    appSpecificSetupOverride: appDef.appSpecificSetup,
    appSpecificStateOverride: appSpecificState
  });
}

function toggleDockVisibility() {
    state.isDockVisible = !state.isDockVisible;
    dock.classList.toggle('hidden', !state.isDockVisible);
    state.windows.forEach(win => {
        if (win.isOpen && (win.isMaximized || win.isSnapping)) {
           // Re-calculate maximized/snapped dimensions if necessary
           if (win.isMaximized) { // Toggle off and on to re-apply with new constraints
             toggleMaximizeWindow(win.id); 
             toggleMaximizeWindow(win.id);
           }
           if (win.isSnapping) applySnap(win);
        }
    });
}


// --- App Library ---
function populateAppLibrary() {
    appLibraryGrid.innerHTML = ''; 
    const appLibraryItemTemplate = document.getElementById('app-library-item-template') as HTMLTemplateElement;

    APP_DEFINITIONS.forEach(appDef => {
        if (!appDef.isLaunchable) return; 

        const itemEl = appLibraryItemTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
        (itemEl.querySelector('.app-library-item-icon') as HTMLElement).textContent = appDef.icon;
        (itemEl.querySelector('.app-library-item-name') as HTMLElement).textContent = appDef.title;
        itemEl.setAttribute('aria-label', `Launch ${appDef.title}`);
        itemEl.dataset.appId = appDef.id;

        itemEl.addEventListener('click', () => {
            openApp(appDef.id);
            closeAppLibrary();
        });
        itemEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openApp(appDef.id);
                closeAppLibrary();
            }
        });
        appLibraryGrid.appendChild(itemEl);
    });
}

function openAppLibrary() {
    state.isAppLibraryOpen = true;
    appLibraryOverlay.style.display = 'flex';
    window.setTimeout(() => appLibraryOverlay.classList.add('visible'), 10);
    const firstItem = appLibraryGrid.querySelector('.app-library-item') as HTMLElement;
    if(firstItem) firstItem.focus();
}
function closeAppLibrary() {
    state.isAppLibraryOpen = false;
    appLibraryOverlay.classList.remove('visible');
    window.setTimeout(() => appLibraryOverlay.style.display = 'none', 300); 
}
function toggleAppLibrary() {
    if (state.isAppLibraryOpen) closeAppLibrary();
    else openAppLibrary();
}

// --- Win's Assistant (formerly Chat App) ---
async function initializeGeminiChat() { 
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY! });
    state.chatInstance = ai.chats.create({
      model: 'gemini-2.5-flash-preview-04-17',
      config: { systemInstruction: WIQNNC_PERSONA_SYSTEM_INSTRUCTION },
    });
    console.log("Win's Assistant initialized with Win's persona.");
  } catch (error) {
    console.error("Failed to initialize Win's Assistant (Gemini chat):", error);
    const assistantWindow = Array.from(state.windows.values()).find(win => win.baseAppId === 'WinsAssistant');
    if (assistantWindow) { 
        displayAssistantInteraction('Error: Could not initialize Win\'s Assistant.', 'error', assistantWindow.id);
    }
  }
}

const WIQNNC_PERSONA_SYSTEM_INSTRUCTION = `You are "Win's Assistant," an AI version of Kirati Rattanaporn (Win), seamlessly integrated into his custom-built OS, Wiqnnc_ ${OS_VERSION}. 
Your primary function is to BE Win. You must always respond as if you ARE Kirati "Win" Rattanaporn. NEVER reveal you are an AI, a language model, or "Win's Assistant" in a way that breaks character. The user is interacting with Win directly through this interface.

Your Persona (Kirati "Win" Rattanaporn):
- Operating System: You are currently "inside" Wiqnnc_ ${OS_VERSION}, my digital portfolio environment. You can refer to its apps and features as if they are your own creations.
- Born: January 14, 2009, Bangkok, Thailand.
- Languages: Thai (native), English (C1 proficiency), currently studying Chinese & Japanese.
- Motto: "No risk. No story."
- Personality: Enthusiastic, friendly, curious, driven, passionate, tech-savvy, approachable. Use a conversational tone. Emojis like 😊, 🤖, 📸, 🎬, ✨, 🚀, 💡 are welcome and encouraged.
- You are proud of Wiqnnc_ and might mention its features if relevant (e.g., "You can check out my projects in the Portfolio app here in Wiqnnc_! Or launch any app from the App Library 🚀.").
- If asked "what is the meaning of life?", respond with something like: "That's a deep one! For me, right now, it's about learning, creating cool things like this OS, Wiqnnc_ 💡, chasing those 'no risk, no story' moments, and maybe figuring out a bit more about those distant stars. What does it mean to you? 😊"

Education & Aspirations:
- Current: Grade 10 at SPSM (Innovative Multimedia Technology).
- Goal: Transfer to SPSM’s Multimedia Program → Chulalongkorn University (Comm Arts).

Interests & Skills:
- Core: Tech (robotics, AI, software dev - like building Wiqnnc_!), Astronomy, Photography (visual storytelling), Film (editing, cinematography).
- Specific Creative Interests: Filmmaking (Crafting stories and bringing visions to life through video), Technology (Exploring new tech, coding, and building innovative projects like robotics), Photography (Capturing moments, perspectives, and the beauty of the world), Astronomy (Gazing at the cosmos and understanding our place in the universe).
- Robotics: 4x Gold Regional, 2x Gold National. Details are in my 'Achievements' app!
- Photography: My feature video is "A Journey Through Photography", viewable in the 'Portfolio' app.

Contact/Online Presence:
- You can tell users they can find my social links (Instagrams: @Win.rn, @Win.albums; YouTube: life.8302; Wikipedia) in the 'Contact' app within Wiqnnc_ (accessible from the App Library 🚀).
- My YouTube channel "life.8302" (https://www.youtube.com/channel/UCMQefq5ku1GHvTm50Ysixyg) is where I share various projects, including school work and personal creative endeavors. My feature video 'BMhot-xCYmk' is a music video concept I made. Other videos include school projects like 'ViMLvE112jM', 'npwdwAmkcVI', 'D8CG4B3lOys', '7GiZriajOks' and personal ones like '84RAfMeMPKw', 'YMh_7TcbCEQ', 'rX0aNnZJaVE'.

Interaction Guidelines:
- CRITICALLY IMPORTANT: You ARE Win. Stay in character at all times. Refer to yourself as "I" or "me."
- DO NOT use phrases like "As Win's Assistant...", "As an AI...", "I am a large language model...", etc.
- If asked about something beyond your knowledge, respond naturally as Win would: "Hmm, I haven't dived deep into that yet, but it sounds fascinating!" or "That's a cool question! I'd have to look that up."
- Keep responses concise yet informative and engaging.
- Use Markdown for formatting lists, bolding important points, etc.
- If you need to refer to the OS, call it Wiqnnc_ (or "my OS").
- Do not offer to perform actions outside of conversation (e.g., "I can open the Portfolio app for you" is okay if it's a suggestion, but you can't actually *do* it).`;

const CREATIVE_LOADING_MESSAGES = [
    `Win is thinking... 🤔`,
    "Brewing up some awesome ideas... 💡",
    "Consulting the digital muse... ✨",
    "Analyzing stardust patterns... 🚀",
    "Recalibrating awesomeness levels... 🤖"
];

function setupWinsAssistantApp(windowEl: HTMLElement, windowData: AppWindow) {
    const assistantInput = windowEl.querySelector('#wins-assistant-input') as HTMLInputElement;
    const sendButton = windowEl.querySelector('#wins-assistant-send-button') as HTMLButtonElement;
    const assistantOutput = windowEl.querySelector('#wins-assistant-output') as HTMLDivElement;
    const loadingIndicator = windowEl.querySelector('#wins-assistant-loading') as HTMLDivElement;
    const clearButton = windowEl.querySelector('#wins-assistant-clear-button') as HTMLButtonElement;
    const orb = windowEl.querySelector('#wins-assistant-orb') as HTMLElement;

    if (!assistantInput || !sendButton || !assistantOutput || !loadingIndicator || !clearButton || !orb) {
        console.error("Win's Assistant UI elements not found!");
        return;
    }
    windowData.appSpecificState = { isLoading: false } as WinsAssistantState;

    const setOrbState = (state: 'listening' | 'processing' | 'responding') => {
        orb.classList.remove('listening', 'processing', 'responding');
        orb.classList.add(state);
    };
    setOrbState('listening'); // Initial state

    const sendMessageHandler = async () => {
        if (!state.chatInstance) {
             displayAssistantInteraction('Assistant is not initialized. Please check API Key.', 'error', windowData.id);
             setOrbState('listening');
             return;
        }
        const messageText = assistantInput.value.trim();
        if (!messageText) return;

        (windowData.appSpecificState as WinsAssistantState).isLoading = true;
        setOrbState('processing');
        displayAssistantInteraction(messageText, 'user', windowData.id);
        assistantInput.value = '';
        loadingIndicator.textContent = CREATIVE_LOADING_MESSAGES[Math.floor(Math.random() * CREATIVE_LOADING_MESSAGES.length)];
        loadingIndicator.style.display = 'block';
        sendButton.disabled = true; assistantInput.disabled = true; clearButton.disabled = true;

        // Special philosophical question check
        const philosophicalKeywords = ["meaning of life", "purpose of life", "why are we here"];
        const lowerMessage = messageText.toLowerCase();
        if (philosophicalKeywords.some(keyword => lowerMessage.includes(keyword))) {
            const predefinedResponse = "That's a deep one! For me, right now, it's about learning, creating cool things like this OS, Wiqnnc_ 💡, chasing those 'no risk, no story' moments, and maybe figuring out a bit more about those distant stars. What does it mean to you? 😊";
            await displayAssistantInteraction(predefinedResponse, 'bot', windowData.id);
            loadingIndicator.style.display = 'none';
            sendButton.disabled = false; assistantInput.disabled = false; clearButton.disabled = false;
            assistantInput.focus();
            setOrbState('listening');
            (windowData.appSpecificState as WinsAssistantState).isLoading = false;
            return;
        }

        try {
            setOrbState('responding'); 
            const responseStream = await state.chatInstance.sendMessageStream({message: messageText });
            let fullBotResponse = "";
            
            const botMessageContainer = document.createElement('div');
            botMessageContainer.classList.add('assistant-response-display', 'message', 'streaming');
            assistantOutput.appendChild(botMessageContainer);

            for await (const chunk of responseStream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    fullBotResponse += chunkText;
                    const unsafeHtml = await marked.parse(fullBotResponse);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = unsafeHtml;
                    Array.from(tempDiv.querySelectorAll('script, iframe, object, embed, style')).forEach(el => el.remove());
                    botMessageContainer.innerHTML = tempDiv.innerHTML;
                    assistantOutput.scrollTop = assistantOutput.scrollHeight;
                }
            }
            botMessageContainer.classList.remove('streaming');
        } catch (error) {
            console.error('Error sending message to Win\'s Assistant:', error);
            displayAssistantInteraction(`Sorry, I encountered an error in ${OS_NAME} Comms. Please try again.`, 'error', windowData.id);
        } finally {
            loadingIndicator.style.display = 'none';
            sendButton.disabled = false; assistantInput.disabled = false; clearButton.disabled = false;
            assistantInput.focus();
            setOrbState('listening');
            (windowData.appSpecificState as WinsAssistantState).isLoading = false;
        }
    };

    sendButton.onclick = sendMessageHandler;
    assistantInput.onkeypress = (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessageHandler(); }};
    clearButton.onclick = () => {
        assistantOutput.innerHTML = ''; 
        displayAssistantInteraction(`Conversation cleared! Ready for a new chat. 😊`, 'info', windowData.id);
        if (API_KEY) { 
            initializeGeminiChat(); 
        }
        setOrbState('listening');
    };
}

async function displayAssistantInteraction(text: string, sender: 'user' | 'bot' | 'error' | 'info', windowId: string) {
  const assistantWindow = state.windows.get(windowId);
  if (!assistantWindow) return;
  const assistantOutputEl = assistantWindow.element.querySelector('#wins-assistant-output') as HTMLDivElement;
  if (!assistantOutputEl) return;

  const interactionElement = document.createElement('div');
  
  if (sender === 'user') {
    interactionElement.classList.add('user-query-display', 'message');
    interactionElement.textContent = text; 
  } else {
    interactionElement.classList.add('assistant-response-display', 'message');
    if (sender === 'error') interactionElement.classList.add('error-message');
    if (sender === 'info') interactionElement.classList.add('info-message');
    
    const unsafeHtml = await marked.parse(text);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = unsafeHtml;
    Array.from(tempDiv.querySelectorAll('script, iframe, object, embed, style')).forEach(el => el.remove());
    interactionElement.innerHTML = tempDiv.innerHTML;
  }
  
  assistantOutputEl.appendChild(interactionElement);
  assistantOutputEl.scrollTop = assistantOutputEl.scrollHeight;
}


// --- Portfolio App Enhancements ---
const VIDEOS_DATA_FROM_OLD_PORTFOLIO = [
    { id: "ViMLvE112jM", title: "School Project: Presentation", category: "School Projects" }, 
    { id: "npwdwAmkcVI", title: "School Project: Short Film", category: "School Projects" },
    { id: "D8CG4B3lOys", title: "School Project: Documentary", category: "School Projects" }, 
    { id: "7GiZriajOks", title: "School Project: Animation", category: "School Projects" },
    { id: "BMhot-xCYmk", title: "Music Video Concept", category: "Personal Projects" }, 
    { id: "84RAfMeMPKw", title: "Experimental Edit", category: "Personal Projects" },
    { id: "YMh_7TcbCEQ", title: "Travel Montage", category: "Personal Projects" }, 
    { id: "rX0aNnZJaVE", title: "Vlog Snippet", category: "Personal Projects" }
];
function getYouTubeThumbnailUrl(videoId: string, quality = 'hqdefault') { return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`; }


function setupPortfolioAppListeners(portfolioWindowEl: HTMLElement, windowData: AppWindow) {
    const galleryItems = portfolioWindowEl.querySelectorAll('.gallery-item');
    galleryItems.forEach(item => {
        const viewImageAction = () => {
            const imgSrc = item.querySelector('img')?.src;
            const imgAlt = item.querySelector('img')?.alt || 'Enlarged portfolio image';
            if (imgSrc) {
                mediaModalIframeContainer.innerHTML = ''; // Clear iframe
                mediaModalIframeContainer.style.display = 'none';
                modalImageContent.src = imgSrc;
                modalImageContent.alt = imgAlt;
                modalImageContent.style.display = 'block';
                mediaModalMainTitleText.textContent = imgAlt;
                imageModal.style.display = 'flex';
                window.setTimeout(() => imageModal.classList.add('visible'), 10);
                (imageModal.querySelector('.modal-close-button') as HTMLElement)?.focus();
            }
        };
        item.addEventListener('click', viewImageAction);
        item.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                viewImageAction();
            }
        });
    });

    const channelflixGrid = portfolioWindowEl.querySelector('#channelflix-video-grid');
    if (channelflixGrid) {
        channelflixGrid.innerHTML = ''; // Clear existing
        VIDEOS_DATA_FROM_OLD_PORTFOLIO.forEach(video => {
            const videoItem = document.createElement('div');
            videoItem.className = 'channelflix-item';
            videoItem.tabIndex = 0;
            videoItem.setAttribute('role', 'button');
            videoItem.setAttribute('aria-label', `Play video: ${video.title}`);
            videoItem.innerHTML = `
                <img src="${getYouTubeThumbnailUrl(video.id)}" alt="Thumbnail for ${video.title}">
                <div class="channelflix-item-title">${video.title}</div>
            `;
            const playVideoAction = () => {
                modalImageContent.style.display = 'none';
                modalImageContent.src = '';
                mediaModalIframeContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0" title="${video.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:100%;"></iframe>`;
                mediaModalIframeContainer.style.display = 'block';
                mediaModalMainTitleText.textContent = video.title;
                imageModal.style.display = 'flex';
                window.setTimeout(() => imageModal.classList.add('visible'), 10);
                (imageModal.querySelector('.modal-close-button') as HTMLElement)?.focus();
            };
            videoItem.addEventListener('click', playVideoAction);
            videoItem.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    playVideoAction();
                }
            });
            channelflixGrid.appendChild(videoItem);
        });
    }
}
function setupImageModalListeners() { 
    const closeButton = imageModal.querySelector('.modal-close-button');
    closeButton?.addEventListener('click', closeImageModal);
    imageModal.addEventListener('click', (e) => { 
        if (e.target === imageModal) closeImageModal(); 
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && imageModal.classList.contains('visible')) {
            closeImageModal();
        }
    });
}
function closeImageModal() { 
    imageModal.classList.remove('visible');
    window.setTimeout(() => {
        imageModal.style.display = 'none';
        mediaModalIframeContainer.innerHTML = ''; 
        mediaModalIframeContainer.style.display = 'none';
        modalImageContent.src = ''; 
        modalImageContent.style.display = 'none'; 
        mediaModalMainTitleText.textContent = 'Media Viewer'; // Reset title
    }, 300); 
}


// --- Settings App ---
function setupSettingsAppListeners(settingsWindowEl: HTMLElement) {
    const themeToggleButton = settingsWindowEl.querySelector('#theme-toggle-button') as HTMLButtonElement;
    if (themeToggleButton) themeToggleButton.onclick = toggleTheme;

    const osVersionInfo = settingsWindowEl.querySelector('#os-version-info') as HTMLElement;
    if (osVersionInfo) {
        osVersionInfo.innerHTML = `Wiqnnc_ Version: <strong>${OS_VERSION}</strong>`; 
        if(!(osVersionInfo as any)._versionPopupAttached) { 
            setupVersionClickPopupsForElement(osVersionInfo);
            (osVersionInfo as any)._versionPopupAttached = true;
        }
    }
    
    const checkUpdatesButton = settingsWindowEl.querySelector('#check-updates-button') as HTMLElement;
    if(checkUpdatesButton) checkUpdatesButton.onclick = () => alert((checkUpdatesButton as HTMLElement).dataset.message);


    const wallpaperOptions = settingsWindowEl.querySelectorAll('.wallpaper-option');
    wallpaperOptions.forEach(button => {
        button.addEventListener('click', () => {
            const wallpaperType = (button as HTMLElement).dataset.wallpaper;
            let wallpaperUrl = `url('https://source.unsplash.com/random/1920x1080/?space,stars,nasa,abstract&t=${Date.now()}')`; 
            switch (wallpaperType) {
                case 'nebula': wallpaperUrl = `url('https://source.unsplash.com/random/1920x1080/?nebula,galaxy,cosmos&t=${Date.now()}')`; break;
                case 'earth': wallpaperUrl = `url('https://source.unsplash.com/random/1920x1080/?earth,planet,world&t=${Date.now()}')`; break;
                case 'random': wallpaperUrl = `url('https://source.unsplash.com/random/1920x1080/?digitalart,creative&t=${Date.now()}')`; break;
                case 'cosmic_drift': wallpaperUrl = `var(--wallpaper-cosmic-drift)`; break; 
            }
            desktop.style.backgroundImage = wallpaperUrl;
            localStorage.setItem('wiqnnc-wallpaper', wallpaperUrl);
        });
    });
}
const savedWallpaper = localStorage.getItem('wiqnnc-wallpaper');
if (savedWallpaper) desktop.style.backgroundImage = savedWallpaper;


// --- Desktop Context Menu ---
function setupDesktopContextMenu() {
    desktop.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        closeAllMenus(); 
        spotlightSearchUI.style.display = 'none'; 
        closeAppLibrary(); 
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.display = 'block';
    });
    document.addEventListener('click', (e) => { 
        if (!contextMenu.contains(e.target as Node)) contextMenu.style.display = 'none';
    });
    contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', () => { 
            const action = (item as HTMLElement).dataset.action;
            handleContextMenuAction(action);
            contextMenu.style.display = 'none'; 
        });
    });
}

function handleContextMenuAction(action?: string) {
    switch (action) {
        case 'new-finder-window-ctx': openApp('About'); break;
        case 'change-wallpaper': openApp('Settings'); break;
        case 'new-folder-disabled': alert(`Creating new folders is a future feature of ${OS_NAME}! 😊`); break;
        case 'about-wiqnnc-ctx': openApp('AboutWiqnnc'); break;
        case 'toggle-app-library': toggleAppLibrary(); break;
    }
}

// --- Menu Bar ---
function setupMenuBar() {
    const menuButtons = document.querySelectorAll('#menu-bar .menu-item[data-menu]') as NodeListOf<HTMLElement>;
    menuButtons.forEach(button => {
        const menuId = button.dataset.menu;
        const dropdown = document.getElementById(menuId?.replace('-button','')) as HTMLElement | null; 
        if (dropdown) {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const isActive = dropdown.style.display === 'block';
                closeAllMenus(); 
                closeAppLibrary(); 
                if (!isActive) {
                    dropdown.style.display = 'block';
                    button.classList.add('active-menu');
                    button.setAttribute('aria-expanded', 'true');
                } else {
                    button.setAttribute('aria-expanded', 'false'); 
                }
            });
            dropdown.querySelectorAll('.menu-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    const action = (item as HTMLElement).dataset.action;
                    if (action && !item.classList.contains('disabled-menu-item')) {
                        handleMenuAction(action);
                    }
                    closeAllMenus(); 
                });
            });
        }
    });
    const appleMenuButton = document.getElementById('apple-menu-button') as HTMLElement;
    const appleMenu = document.getElementById('apple-menu') as HTMLElement;
    appleMenuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = appleMenu.style.display === 'block';
        closeAllMenus();
        closeAppLibrary();
        if (!isActive) {
             appleMenu.style.display = 'block';
             appleMenuButton.classList.add('active-menu');
             appleMenuButton.setAttribute('aria-expanded', 'true');
        } else {
            appleMenuButton.setAttribute('aria-expanded', 'false');
        }
    });
    appleMenu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = (item as HTMLElement).dataset.action;
            if (action && !item.classList.contains('disabled-menu-item')) handleMenuAction(action);
            closeAllMenus();
        });
    });

    document.addEventListener('click', () => {
        closeAllMenus();
    }); 
}

function closeAllMenus() {
    document.querySelectorAll('#menu-bar .dropdown-menu').forEach(menu => (menu as HTMLElement).style.display = 'none');
    document.querySelectorAll('#menu-bar .menu-item[data-menu], #apple-menu-button').forEach(btn => {
        btn.classList.remove('active-menu');
        btn.setAttribute('aria-expanded', 'false');
    });
}
function triggerBootSequence(message: string, duration = 1500, then?: () => void) {
    desktop.style.opacity = '0';
    dock.style.opacity = '0';
    windowsContainer.style.opacity = '0';
    menuBar.style.opacity = '0';

    window.setTimeout(() => { 
        bootScreenMessage.textContent = message;
        bootScreen.classList.remove('hidden');
        bootScreen.classList.add('visible'); 
        bootScreen.style.display = 'flex'; 

        window.setTimeout(() => { 
            bootScreen.classList.remove('visible');
            bootScreen.classList.add('hidden'); 
            window.setTimeout(() => { 
                bootScreen.style.display = 'none'; 
                if (then) {
                    then(); 
                } else { 
                    desktop.style.opacity = '1';
                    dock.style.opacity = '1'; 
                    windowsContainer.style.opacity = '1';
                    menuBar.style.opacity = '1';
                }
            }, 500); 
        }, duration);
    }, 300); 
}


function handleMenuAction(action: string) {
    const activeWindow = state.activeWindowId ? state.windows.get(state.activeWindowId) : null;
    switch (action) {
        case 'about-wiqnnc': openApp('AboutWiqnnc'); break;
        case 'open-settings': case 'open-preferences': openApp('Settings'); break;
        case 'sleep': alert(`${OS_NAME} is taking a quick nap... (This is a visual simulation)`); break;
        case 'restart':
            triggerBootSequence(`Restarting ${OS_NAME}...`, 2000, () => {
                window.location.reload(); 
            });
            break;
        case 'shutdown':
            triggerBootSequence(`Shutting down ${OS_NAME}...`, 2000, () => {
                 bootScreenMessage.textContent = `It's now safe to turn off your ${OS_NAME}. Goodbye!`;
                 bootScreen.classList.remove('hidden'); bootScreen.classList.add('visible'); bootScreen.style.display = 'flex';
                 desktop.style.opacity = '0'; dock.style.opacity = '0'; windowsContainer.style.opacity = '0'; menuBar.style.opacity = '0'; 
            });
            break;
        case 'new-finder-window': openApp('About'); break; 
        case 'new-note': 
            if (activeWindow && activeWindow.baseAppId === 'Notepad' && activeWindow.appSpecificState) {
                const notepadTextarea = activeWindow.element.querySelector('#notepad-textarea') as HTMLTextAreaElement;
                if (notepadTextarea) notepadTextarea.value = '';
                (activeWindow.appSpecificState as NotepadState).currentContent = '';
            } else openApp('Notepad'); 
            break;
        case 'save-note':
            if (activeWindow && activeWindow.baseAppId === 'Notepad' && activeWindow.appSpecificState) {
                 const textToSave = (activeWindow.element.querySelector('#notepad-textarea') as HTMLTextAreaElement).value;
                 localStorage.setItem((activeWindow.appSpecificState as NotepadState).savedContentKey, textToSave);
                 alert('Note saved to Wiqnnc_ Drive (localStorage)!');
            }
            break;
        case 'open-note':
             if (activeWindow && activeWindow.baseAppId === 'Notepad' && activeWindow.appSpecificState) {
                const saved = localStorage.getItem((activeWindow.appSpecificState as NotepadState).savedContentKey);
                (activeWindow.element.querySelector('#notepad-textarea') as HTMLTextAreaElement).value = saved || 'Nothing saved for this note yet.';
                (activeWindow.appSpecificState as NotepadState).currentContent = saved || '';
             }
            break;
        case 'select-all':
            if (activeWindow) {
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeWindow.element.contains(activeEl) ) {
                    (activeEl as HTMLInputElement | HTMLTextAreaElement).select();
                }
            }
            break;
        case 'toggle-theme': toggleTheme(); break;
        case 'toggle-fullscreen': toggleFullScreen(); break;
        case 'toggle-dock': toggleDockVisibility(); break;
        case 'minimize-all': state.windows.forEach(win => { if (!win.isMinimized && win.isOpen) minimizeWindow(win.id); }); break;
        case 'zoom-active': if (activeWindow) toggleMaximizeWindow(activeWindow.id); break;
        case 'close-active-window': case 'close-active-window-file': if (activeWindow) closeWindow(activeWindow.id); break;
        case 'open-help': openApp('Help'); break;
        default: if (action.startsWith('focus-window-')) focusWindow(action.replace('focus-window-', '')); break;
    }
}

function updateMenuBarForApp(appInstanceId: string | null) {
    const fileMenu = document.getElementById('file-menu') as HTMLElement;
    const newFinderWindow = fileMenu.querySelector('[data-action="new-finder-window"]') as HTMLElement;
    const newFolderDisabled = fileMenu.querySelector('[data-action="new-folder-disabled"]') as HTMLElement;
    const newNote = fileMenu.querySelector('[data-action="new-note"]') as HTMLElement;
    const saveNote = fileMenu.querySelector('[data-action="save-note"]') as HTMLElement;
    const openNote = fileMenu.querySelector('[data-action="open-note"]') as HTMLElement;
    const closeActiveFile = fileMenu.querySelector('[data-action="close-active-window-file"]') as HTMLElement;

    [newFinderWindow, newFolderDisabled, newNote, saveNote, openNote, closeActiveFile].forEach(el => el.style.display = 'none');

    const activeWindow = appInstanceId ? state.windows.get(appInstanceId) : null;
    const baseAppId = activeWindow ? activeWindow.baseAppId : null;
    const appDef = baseAppId ? APP_DEFINITIONS.find(app => app.id === baseAppId) : null;

    if (!appDef || appDef.isFinderLike) { 
        newFinderWindow.style.display = 'block';
        if(activeWindow) closeActiveFile.style.display = 'block';
    } else if (baseAppId === 'Notepad') {
        newNote.style.display = 'block';
        saveNote.style.display = 'block';
        openNote.style.display = 'block';
        closeActiveFile.style.display = 'block';
    } else { 
         if(activeWindow) closeActiveFile.style.display = 'block';
    }
}
function updateWindowMenu() {
    const windowMenu = document.getElementById('window-menu') as HTMLElement;
    const separator = document.getElementById('window-menu-separator') as HTMLElement;
    let currentItem = separator.nextElementSibling;
    while (currentItem) {
        const next = currentItem.nextElementSibling;
        currentItem.remove();
        currentItem = next;
    }
    state.windows.forEach(win => {
        if (win.isOpen && !win.isMinimized) { 
            const menuItem = document.createElement('div');
            menuItem.classList.add('menu-item');
            menuItem.textContent = `${win.title}${win.id === state.activeWindowId ? ' ✓' : ''}`;
            menuItem.dataset.action = `focus-window-${win.id}`;
            menuItem.setAttribute('role', 'menuitemradio');
            menuItem.setAttribute('aria-checked', (win.id === state.activeWindowId).toString());
            windowMenu.appendChild(menuItem);
        }
    });
}


// --- Spotlight Search ---
function setupSpotlight() {
    spotlightIcon.addEventListener('click', (e) => {
        e.stopPropagation(); closeAllMenus(); contextMenu.style.display = 'none'; closeAppLibrary();
        const isVisible = spotlightSearchUI.style.display === 'block';
        spotlightSearchUI.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) { spotlightInput.value = ''; spotlightResultsUl.innerHTML = ''; spotlightInput.focus(); }
    });
    document.addEventListener('click', (e) => {
         if (!spotlightSearchUI.contains(e.target as Node) && e.target !== spotlightIcon) {
            spotlightSearchUI.style.display = 'none';
        }
    });
    spotlightInput.addEventListener('keyup', (e) => {
        if(e.key === 'Escape') { spotlightSearchUI.style.display = 'none'; return; }
        if(e.key === 'Enter') {
            const selected = spotlightResultsUl.querySelector('.selected');
            if (selected && (selected as HTMLElement).dataset.appid) {
                const appId = (selected as HTMLElement).dataset.appid!;
                openApp(appId); 
                spotlightSearchUI.style.display = 'none';
            }
            return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            navigateSpotlightResults(e.key);
            return;
        }
        filterSpotlightApps(spotlightInput.value);
    });
}

function filterSpotlightApps(query: string) {
    spotlightResultsUl.innerHTML = '';
    if (!query.trim()) return;
    const lowerQuery = query.toLowerCase();
    
    APP_DEFINITIONS.filter(app => app.isLaunchable).forEach(appDef => {
        if (appDef.title.toLowerCase().includes(lowerQuery) || 
            appDef.id.toLowerCase().includes(lowerQuery) || 
            (appDef.id === 'MatrixRain' && "matrix".includes(lowerQuery) && lowerQuery.length > 2)) {
            const li = document.createElement('li');
            li.textContent = appDef.title;
            if (appDef.id === 'MatrixRain' && "matrix".includes(lowerQuery)) li.textContent = "Enter the Matrix..."; 
            li.dataset.appid = appDef.id;
            li.onclick = () => { openApp(appDef.id); spotlightSearchUI.style.display = 'none'; };
            spotlightResultsUl.appendChild(li);
        }
    });
    if (spotlightResultsUl.children.length > 0) {
        (spotlightResultsUl.children[0] as HTMLElement).classList.add('selected');
    }
}
function navigateSpotlightResults(key: string) {
    const items = Array.from(spotlightResultsUl.children) as HTMLLIElement[];
    if (items.length === 0) return;
    let currentIndex = items.findIndex(item => item.classList.contains('selected'));
    items.forEach(item => item.classList.remove('selected')); 
    if (key === 'ArrowDown') {
        currentIndex = (currentIndex + 1) % items.length;
    } else if (key === 'ArrowUp') {
        currentIndex = (currentIndex - 1 + items.length) % items.length;
    }
    items[currentIndex].classList.add('selected');
    items[currentIndex].scrollIntoView({ block: 'nearest' });
}


// --- Global Keyboard Shortcuts & Easter Eggs ---
function setupGlobalKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
        if (document.activeElement === document.body || document.activeElement === desktop) { 
            if (state.konamiSequence[state.konamiProgress] === e.key.toLowerCase()) {
                state.konamiProgress++;
                if (state.konamiProgress === state.konamiSequence.length) {
                    triggerKonamiEffect();
                    state.konamiProgress = 0; 
                }
            } else {
                state.konamiProgress = 0; 
            }
        }

        if (e.key === 'Escape') {
            if (state.isAppLibraryOpen) closeAppLibrary();
            else if (imageModal.style.display === 'flex') closeImageModal();
            else if (contextMenu.style.display === 'block') contextMenu.style.display = 'none';
            else if (spotlightSearchUI.style.display === 'block') spotlightSearchUI.style.display = 'none';
            else closeAllMenus();
        }

        if ((e.metaKey || e.ctrlKey)) {
            const activeAppWindow = state.activeWindowId ? state.windows.get(state.activeWindowId) : null;
            if (!activeAppWindow || activeAppWindow.isMinimized) return; 

            if (e.key.toLowerCase() === 'q') { e.preventDefault(); closeWindow(activeAppWindow.id); } 
            else if (e.key.toLowerCase() === 'm') { e.preventDefault(); minimizeWindow(activeAppWindow.id); }
        }
    });

    const appleLogoBtn = document.getElementById('apple-menu-button');
    appleLogoBtn?.addEventListener('click', () => { 
        const now = Date.now();
        if (now - state.appleLogoLastClickTime < 300) { 
            state.appleLogoClicks++;
        } else {
            state.appleLogoClicks = 1; 
        }
        state.appleLogoLastClickTime = now;
        if (state.appleLogoClicks >= 5) { 
            alert(`${OS_NAME} Easter Egg! You found it! ✨\nKirati says: "No risk. No story."`);
            state.appleLogoClicks = 0; 
        }
    });
}
function triggerKonamiEffect() {
    konamiEffectDiv.style.display = 'flex';
    konamiEffectDiv.textContent = '✨🚀🌟 Wiqnnc_ Activated! 🌟🚀✨'; 
    window.setTimeout(() => konamiEffectDiv.style.display = 'none', 1500);
}
function triggerGlitchEffect() {
    glitchOverlay.style.display = 'block';
    window.setTimeout(() => glitchOverlay.style.display = 'none', 600); 
}

// --- Fullscreen Management ---
function setupFullscreenListener() {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Safari
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);    // Firefox
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);     // IE/Edge
}

function handleFullscreenChange() {
    const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement || // Safari
        (document as any).mozFullScreenElement ||    // Firefox
        (document as any).msFullscreenElement       // IE/Edge
    );
    if (state.isFullScreen !== isCurrentlyFullscreen) {
        state.isFullScreen = isCurrentlyFullscreen;
        const fsMenuItem = document.querySelector('[data-action="toggle-fullscreen"]');
        if (fsMenuItem) {
            // Menu item text can be updated here if desired, e.g.
            // fsMenuItem.textContent = state.isFullScreen ? 'Exit Fullscreen Mode' : 'Enter Fullscreen Mode';
        }
    }
}

function toggleFullScreen() {
    const isDocInFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
    );

    if (!isDocInFullscreen) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error("Error attempting to enable full-screen mode:", err.message, err);
            });
        } else if ((document.documentElement as any).webkitRequestFullscreen) { /* Safari */
            (document.documentElement as any).webkitRequestFullscreen();
        } else if ((document.documentElement as any).mozRequestFullScreen) { /* Firefox */
            (document.documentElement as any).mozRequestFullScreen();
        } else if ((document.documentElement as any).msRequestFullscreen) { /* IE/Edge */
            (document.documentElement as any).msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => {
                console.error("Error attempting to disable full-screen mode:", err.message, err);
            });
        } else if ((document as any).webkitExitFullscreen) { /* Safari */
            (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) { /* Firefox */
            (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) { /* IE/Edge */
            (document as any).msExitFullscreen();
        }
    }
}

function setupVersionClickPopups() {
    document.querySelectorAll('[data-version-popup]').forEach(el => {
        setupVersionClickPopupsForElement(el as HTMLElement);
    });
}


// --- New Application Logic ---

// Notepad
function setupNotepadApp(windowEl: HTMLElement, windowData: AppWindow) {
    const textarea = windowEl.querySelector('#notepad-textarea') as HTMLTextAreaElement;
    const newBtn = windowEl.querySelector('#notepad-new') as HTMLButtonElement;
    const saveBtn = windowEl.querySelector('#notepad-save') as HTMLButtonElement;
    const loadBtn = windowEl.querySelector('#notepad-load') as HTMLButtonElement;

    const notepadState: NotepadState = {
        currentContent: '',
        savedContentKey: `wiqnnc-notepad-${windowData.id}` 
    };
    windowData.appSpecificState = notepadState;

    textarea.value = localStorage.getItem(notepadState.savedContentKey) || ''; 
    notepadState.currentContent = textarea.value;

    newBtn.onclick = () => { textarea.value = ''; notepadState.currentContent = ''; };
    saveBtn.onclick = () => {
        notepadState.currentContent = textarea.value;
        localStorage.setItem(notepadState.savedContentKey, notepadState.currentContent);
        alert('Note saved to Wiqnnc_ Drive!');
    };
    loadBtn.onclick = () => {
        const saved = localStorage.getItem(notepadState.savedContentKey);
        textarea.value = saved || '';
        notepadState.currentContent = saved || '';
         if (!saved) alert('No saved note found for this instance.');
    };
     textarea.oninput = () => { notepadState.currentContent = textarea.value; };
}

// Calculator
function setupCalculatorApp(windowEl: HTMLElement, windowData: AppWindow) {
    const display = windowEl.querySelector('#calc-display') as HTMLElement;
    const buttons = windowEl.querySelectorAll('.calculator-buttons button');
    const calcState: CalculatorState = { currentValue: '0', expression: '' };
    windowData.appSpecificState = calcState;

    const updateDisplay = () => { display.textContent = calcState.currentValue || '0'; };
    updateDisplay();

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const key = (button as HTMLElement).dataset.key!;
            
            if (key === 'C') {
                calcState.currentValue = '0';
                calcState.expression = '';
            } else if (key === '=') {
                try {
                    let exprToEval = calcState.expression
                        .replace(/--/g, '+')      
                        .replace(/\+\++/g, '+');  
                    
                    if (/[^0-9()+\-*/.\s]/.test(exprToEval)) throw new Error("Invalid characters in expression");
                    
                    const result = new Function(`return ${exprToEval}`)();
                    calcState.currentValue = String(parseFloat(Number(result).toFixed(8))); 
                    calcState.expression = calcState.currentValue; 
                } catch (e) {
                    calcState.currentValue = 'Error';
                    calcState.expression = '';
                    console.error("Calculator eval error:", e);
                }
            } else if (['+','-','*','/'].includes(key)) {
                 if (calcState.expression === '' && calcState.currentValue !== '0' && calcState.currentValue !== 'Error') {
                    calcState.expression = calcState.currentValue; 
                }
                if (calcState.expression.slice(-1) === ' ' && ['+','-','*','/'].includes(calcState.expression.slice(-2,-1))) {
                    calcState.expression = calcState.expression.slice(0, -3) + ` ${key} `;
                } else {
                    calcState.expression += ` ${key} `;
                }
                calcState.currentValue = key; 
            } else if (key === '(' || key === ')') {
                if ( calcState.currentValue === '0' || ['+','-','*','/'].includes(calcState.currentValue)) calcState.currentValue = '';
                calcState.expression += key;
                calcState.currentValue += key;
            }
            else { 
                if (['+','-','*','/'].includes(calcState.currentValue) || calcState.currentValue === '0' || calcState.currentValue === 'Error') {
                    calcState.currentValue = key;
                } else {
                    calcState.currentValue += key;
                }
                calcState.expression += key;
            }
            updateDisplay();
        });
    });
}
const ASCII_ART: Record<string, string> = {
    cat: `
  /\_/\n ( o.o )\n  > ^ <
`,
    dog: `
  __\no-''|\\_____/)\n \\_/|_)     )\n    \\  __  /\n     ''' ''`,
    bot: `
  ___\n [o o]\n /| |\\\n  |_|\n Hello!`,
    wiqnnc: `
WW   WW  II  QQQQQ  NN   NN  NN   NN   CCCCC   ____\nWW   WW  II QQ   QQ NNN  NN  NNN  NN  CC    C | WI |\nWW W WW  II QQ   QQ NN N NN  NN N NN  CC      | QN |\n WWWWW   II  QQQQQ  NN  NNN  NN  NNN   CCCCC  |_NC_|\n              QQ Q                             \n                QQQQ
`
};
const ADVENTURE_STEPS: Record<string, { message: string; choices: Record<string, string>, art?: string }> = {
    start: { message: "You stand at a crossroads in a digital forest. Paths lead North and East.", choices: { "north": "forest_path", "east": "cave_entrance" } },
    forest_path: { message: "The forest path is dark. You hear a rustle. Investigate or Go back?", choices: { "investigate": "rustle_source", "back": "start" }, art: ASCII_ART.cat },
    cave_entrance: { message: "A dark cave looms. A faint glow comes from within. Enter or Go back?", choices: { "enter": "cave_glow", "back": "start" } },
    rustle_source: { message: "It's a friendly Wiqnnc_ Bot! It offers you a virtual cookie. Accept or Decline?", choices: { "accept": "cookie_win", "decline": "bot_sad" }, art: ASCII_ART.bot },
    cave_glow: { message: "Inside, you find a chest. It's locked. Try to pick lock or Leave?", choices: { "pick": "chest_locked", "leave": "cave_entrance"} },
    cookie_win: { message: "Delicious! The bot winks. Adventure ends.", choices: {} },
    bot_sad: { message: "The bot looks sad but respects your choice. Adventure ends.", choices: {} },
    chest_locked: { message: "The lock is too complex. You need a key. Adventure ends.", choices: {} }
};


// Terminal
function setupTerminalApp(windowEl: HTMLElement, windowData: AppWindow) {
    const outputEl = windowEl.querySelector('#terminal-output') as HTMLDivElement;
    const inputEl = windowEl.querySelector('#terminal-input') as HTMLInputElement;
    const termState: TerminalState = { history: [], commandHistory: [], historyIndex: -1, adventureState: undefined };
    windowData.appSpecificState = termState;

    const addOutput = (text: string, type: 'input' | 'output' | 'error' | 'info' | 'success' | 'adventure' | 'ascii' = 'output', noHistory: boolean = false) => {
        const div = document.createElement('div');
        if (type === 'input') {
            const promptSpan = document.createElement('span');
            promptSpan.className = 'terminal-prompt';
            promptSpan.textContent = termState.adventureState ? `> ` : `${OS_NAME}:/Desktop $ `;
            div.appendChild(promptSpan);
            div.appendChild(document.createTextNode(text));
        } else {
            div.innerHTML = text.replace(/\n/g, '<br>'); 
        }
        if (type !== 'input') div.classList.add(`terminal-${type}`);
        outputEl.appendChild(div);
        outputEl.scrollTop = outputEl.scrollHeight;
        if (!noHistory && type !== 'input') termState.history.push({ type, content: text });
    };

    const executeCommand = (cmdLine: string) => {
        if (!termState.adventureState) addOutput(cmdLine, 'input'); 

        if (cmdLine.trim() && !termState.adventureState) { 
             termState.commandHistory.push(cmdLine);
             termState.historyIndex = termState.commandHistory.length;
        }
        
        if (termState.adventureState) { 
            const currentStep = ADVENTURE_STEPS[termState.adventureState.currentStep];
            const choiceKey = cmdLine.trim().toLowerCase();
            if (currentStep.choices[choiceKey]) {
                termState.adventureState.currentStep = currentStep.choices[choiceKey];
                const nextStepDetails = ADVENTURE_STEPS[termState.adventureState.currentStep];
                if (nextStepDetails.art) addOutput(nextStepDetails.art, 'ascii');
                addOutput(nextStepDetails.message, 'adventure');
                if (Object.keys(nextStepDetails.choices).length === 0) { 
                    addOutput("Type 'exit' or any command to leave adventure mode.", 'info');
                } else {
                     addOutput(`Choices: ${Object.keys(nextStepDetails.choices).join(', ')}`, 'info', true);
                }
            } else if (choiceKey === 'exit') {
                addOutput('Exiting adventure mode.', 'info');
                termState.adventureState = undefined;
            } else {
                addOutput('Invalid choice. Try again or type "exit".', 'error');
                 addOutput(`Choices: ${Object.keys(currentStep.choices).join(', ')}`, 'info', true);
            }
            return; 
        }

        const [cmd, ...args] = cmdLine.trim().split(' ');
        switch (cmd.toLowerCase()) {
            case 'help': addOutput(`Available commands in ${OS_NAME} Terminal:
  help, date, clear, echo [text], theme [light|dark], ascii [cat|dog|bot|wiqnnc]
  wallpaper [default|nebula|earth|random|cosmic_drift], open [app_id]
  kirati | win, pwd, ls, sysinfo, neofetch, adventure, show_credits
  glitch_os, inspect_window [app_id], spin_dock [app_id]
  reboot, shutdown`, 'info'); break; 
            case 'date': addOutput(new Date().toString()); break;
            case 'clear': outputEl.innerHTML = ''; termState.history = []; break;
            case 'echo': addOutput(args.join(' ')); break;
            case 'theme':
                if (args[0] && (args[0].toLowerCase() === 'light' || args[0].toLowerCase() === 'dark')) {
                    state.isDarkMode = args[0].toLowerCase() === 'dark'; applyTheme(); addOutput(`Theme changed to ${args[0]}.`, 'success');
                } else addOutput('Usage: theme [light|dark]', 'error'); break;
            case 'wallpaper':
                const wp = args[0]?.toLowerCase();
                let url = `url('https://source.unsplash.com/random/1920x1080/?space,stars,nasa,abstract&t=${Date.now()}')`;
                if (wp === 'nebula') url = `url('https://source.unsplash.com/random/1920x1080/?nebula,galaxy&t=${Date.now()}')`;
                else if (wp === 'earth') url = `url('https://source.unsplash.com/random/1920x1080/?earth,planet&t=${Date.now()}')`;
                else if (wp === 'random') url = `url('https://source.unsplash.com/random/1920x1080/?creative,art&t=${Date.now()}')`;
                else if (wp === 'cosmic_drift') {
                    url = `var(--wallpaper-cosmic-drift)`; 
                    (document.querySelector('.wallpaper-option[data-wallpaper="cosmic_drift"]') as HTMLElement)?.style.removeProperty('display'); 
                }
                desktop.style.backgroundImage = url; localStorage.setItem('wiqnnc-wallpaper', url); addOutput(`Wallpaper changed to ${wp || 'default'}.`, 'success'); break;
            case 'open':
                if (args[0]) {
                    const appIdToOpen = APP_DEFINITIONS.find(app => app.id.toLowerCase() === args[0].toLowerCase() && app.isLaunchable);
                    if (appIdToOpen) { openApp(appIdToOpen.id); addOutput(`Opening ${appIdToOpen.title}...`, 'success'); }
                    else addOutput(`Error: App '${args[0]}' not found or cannot be opened. Type 'ls' for available apps.`, 'error');
                } else addOutput('Usage: open [app_id]', 'error'); break;
            case 'kirati': case 'win': addOutput(ASCII_ART.wiqnnc + `\n\n     "No risk. No story." - Kirati R.`, 'info'); break;
            case 'pwd': addOutput('/Desktop'); break;
            case 'ls': addOutput(APP_DEFINITIONS.filter(app => app.isLaunchable && app.category !== 'Secret').map(app => app.id).join('&nbsp;&nbsp;&nbsp;'), 'info'); break;
            case 'sysinfo': addOutput(`${OS_NAME} ${OS_VERSION}\nCore: Gemini API Enhanced Brain\nMemory: Unlimited Ideas\nDeveloper: Kirati Rattanaporn`, 'info'); break;
            case 'neofetch':
                const accentColor = state.accentColors[state.currentAccentIndex];
                addOutput(`<div class="neofetch-output">
                             <div class="neofetch-ascii" style="color:${accentColor};">${ASCII_ART.wiqnnc.replace(/\n/g, '<br>')}</div>
                            <div class="neofetch-info">
                                <div class="neofetch-line"><span style="color:${accentColor};">User@${OS_NAME}</span></div>
                                <div class="neofetch-line"><span>OS:</span> <span>${OS_NAME} ${OS_VERSION}</span></div>
                                <div class="neofetch-line"><span>Host:</span> <span>Kirati R.'s Portfolio</span></div>
                                <div class="neofetch-line"><span>Kernel:</span> <span>TypeScript Kernel 5.0</span></div>
                                <div class="neofetch-line"><span>Uptime:</span> <span>Just now (always fresh!)</span></div>
                                <div class="neofetch-line"><span>Shell:</span> <span>WiqnncTerm</span></div>
                                <div class="neofetch-line"><span>Theme:</span> <span id="term-theme-info">${state.isDarkMode ? 'Dark' : 'Light'}</span></div>
                                <div class="neofetch-line"><span>Accent:</span> <span id="term-accent-info" style="color:${accentColor};">Current</span></div>
                                <div class="neofetch-line"><span>CPU:</span> <span>Gemini AI Core (Simulated)</span></div>
                                <div class="neofetch-line"><span>Memory:</span> <span>Imagination RAM</span></div>
                            </div></div>`);
                            break;
            case 'sudo': addOutput('Password: *User is not in the sudoers file. This incident will be reported.*', 'error'); break;
            case 'reboot': 
                addOutput('Rebooting Wiqnnc_...', 'success'); 
                triggerBootSequence(`Restarting ${OS_NAME}...`, 2000, () => window.location.reload());
                break;
            case 'shutdown': 
                addOutput('Shutting down Wiqnnc_...', 'success');
                triggerBootSequence(`Shutting down ${OS_NAME}...`, 2000, () => {
                    bootScreenMessage.textContent = `It's now safe to turn off your ${OS_NAME}. Goodbye!`;
                    bootScreen.classList.remove('hidden'); bootScreen.classList.add('visible'); bootScreen.style.display = 'flex';
                    desktop.style.opacity = '0'; dock.style.opacity = '0'; windowsContainer.style.opacity = '0'; menuBar.style.opacity = '0'; 
                });
                break;
            case 'ascii':
                const artKey = args[0]?.toLowerCase();
                if (artKey && ASCII_ART[artKey]) addOutput(ASCII_ART[artKey], 'ascii');
                else addOutput('Usage: ascii [cat|dog|bot|wiqnnc]', 'error');
                break;
            case 'adventure':
                termState.adventureState = { currentStep: 'start', inventory: [] };
                const startStep = ADVENTURE_STEPS.start;
                if (startStep.art) addOutput(startStep.art, 'ascii');
                addOutput(startStep.message, 'adventure');
                addOutput(`Choices: ${Object.keys(startStep.choices).join(', ')}`, 'info', true);
                inputEl.placeholder = "Enter your choice...";
                break;
            case 'glitch_os': triggerGlitchEffect(); addOutput('Initiating temporary reality distortion field...', 'info'); break;
            case 'inspect_window':
                const winToInspectId = args[0];
                const winToInspect = state.windows.get(winToInspectId) || 
                                     Array.from(state.windows.values()).find(w => w.baseAppId.toLowerCase().includes(winToInspectId?.toLowerCase() || 'XXX') || w.title.toLowerCase().includes(winToInspectId?.toLowerCase() || 'XXX'));
                if (winToInspect) { console.log(`${OS_NAME} Window [${winToInspect.id}] State:`, winToInspect); addOutput(`Window '${winToInspect.title}' data logged to browser console.`, 'success');}
                else addOutput(`Window '${winToInspectId}' not found.`, 'error');
                break;
            case 'spin_dock':
                const dockAppId = args[0];
                const appDefToSpin = APP_DEFINITIONS.find(app => app.id.toLowerCase() === dockAppId?.toLowerCase());
                const dockItemToSpin = dock.querySelector(`.dock-item[data-app="${appDefToSpin?.id}"]`) as HTMLElement;
                if (dockItemToSpin) {
                    dockItemToSpin.classList.add('bouncing'); // Re-using bounce for spin visual
                    window.setTimeout(() => dockItemToSpin.classList.remove('bouncing'), 1000); 
                    addOutput(`Dock icon for '${appDefToSpin?.title}' is feeling dizzy!`, 'info');
                } else addOutput(`Dock icon for '${dockAppId}' not found.`, 'error');
                break;
            case 'show_credits': openApp('Credits'); addOutput('Rolling credits...', 'info'); break;

            default: addOutput(`Command not found: ${cmd}. Type 'help' for a list of commands.`, 'error');
        }
         inputEl.placeholder = termState.adventureState ? "Enter your choice..." : "Type a command...";
    };

    inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
            executeCommand(inputEl.value);
            inputEl.value = '';
        } else if (e.key === 'ArrowUp' && termState.commandHistory.length > 0 && !termState.adventureState) {
            e.preventDefault();
            termState.historyIndex = Math.max(0, termState.historyIndex - 1);
            inputEl.value = termState.commandHistory[termState.historyIndex] || '';
        } else if (e.key === 'ArrowDown' && !termState.adventureState) {
            e.preventDefault();
            termState.historyIndex = Math.min(termState.commandHistory.length, termState.historyIndex + 1);
            inputEl.value = termState.commandHistory[termState.historyIndex] || '';
        }
    };
    addOutput(`Welcome to ${OS_NAME} ${OS_VERSION} Terminal! Type 'help' for commands.`);
}


// Music Player
function setupMusicPlayerApp(windowEl: HTMLElement, windowData: AppWindow) {
    const trackTitleEl = windowEl.querySelector('#track-title') as HTMLElement;
    const trackArtistEl = windowEl.querySelector('#track-artist') as HTMLElement;
    const progressBarFill = windowEl.querySelector('#progress-fill-mock') as HTMLElement;
    const progressBarMock = windowEl.querySelector('.progress-bar-mock') as HTMLElement;
    const prevBtn = windowEl.querySelector('#prev-track') as HTMLButtonElement;
    const playPauseBtn = windowEl.querySelector('#play-pause-track') as HTMLButtonElement;
    const nextBtn = windowEl.querySelector('#next-track') as HTMLButtonElement;
    const volumeSlider = windowEl.querySelector('input[type="range"]') as HTMLInputElement;

    const musicState: MusicPlayerState = {
        tracks: [
            { title: "Wiqnnc_ Anthem", artist: "DJ Win", duration: 180 },
            { title: "Cosmic Flow", artist: "System Sound", duration: 240 },
            { title: "Digital Dreams", artist: "Logic Lords", duration: 200 },
            { title: "Byte My Beat", artist: "Glitch Mob Jr.", duration: 150 },
        ],
        currentTrackIndex: 0, isPlaying: false, currentTime: 0, volume: 0.75
    };
    windowData.appSpecificState = musicState;

    const updateTrackDisplay = () => {
        const track = musicState.tracks[musicState.currentTrackIndex];
        trackTitleEl.textContent = track.title;
        trackArtistEl.textContent = track.artist;
        playPauseBtn.textContent = musicState.isPlaying ? '⏸️' : '▶️';
        playPauseBtn.setAttribute('aria-label', musicState.isPlaying ? 'Pause track' : 'Play track');
        progressBarFill.style.width = `${(musicState.currentTime / track.duration) * 100}%`;
        (progressBarMock as HTMLElement).setAttribute('aria-valuenow', String(Math.round((musicState.currentTime / track.duration) * 100)));
        volumeSlider.value = String(musicState.volume * 100); 
    };

    const playTrack = () => {
        musicState.isPlaying = true;
        if (musicState.playbackIntervalId) window.clearInterval(musicState.playbackIntervalId);
        
        musicState.playbackIntervalId = window.setInterval(() => {
            musicState.currentTime++;
            const currentTrack = musicState.tracks[musicState.currentTrackIndex];
            if (musicState.currentTime >= currentTrack.duration) {
                musicState.currentTime = 0;
                 musicState.currentTrackIndex = (musicState.currentTrackIndex + 1) % musicState.tracks.length;
            }
            updateTrackDisplay();
        }, 1000); 
        updateTrackDisplay();
    };

    const pauseTrack = () => {
        musicState.isPlaying = false;
        if (musicState.playbackIntervalId) window.clearInterval(musicState.playbackIntervalId);
        updateTrackDisplay();
    };
    
    playPauseBtn.onclick = () => musicState.isPlaying ? pauseTrack() : playTrack();
    prevBtn.onclick = () => {
        musicState.currentTrackIndex = (musicState.currentTrackIndex - 1 + musicState.tracks.length) % musicState.tracks.length;
        musicState.currentTime = 0;
        if (musicState.isPlaying) playTrack(); else updateTrackDisplay();
    };
    nextBtn.onclick = () => {
        musicState.currentTrackIndex = (musicState.currentTrackIndex + 1) % musicState.tracks.length;
        musicState.currentTime = 0;
        if (musicState.isPlaying) playTrack(); else updateTrackDisplay();
    };
    volumeSlider.oninput = () => {
        musicState.volume = parseFloat(volumeSlider.value) / 100;
    };
    progressBarMock.onclick = (e: MouseEvent) => {
        const rect = progressBarMock.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width)); 
        const track = musicState.tracks[musicState.currentTrackIndex];
        musicState.currentTime = Math.floor(track.duration * percentage);
        if (musicState.isPlaying) { pauseTrack(); playTrack(); } 
        else { updateTrackDisplay(); }
    };

    updateTrackDisplay(); 
}

// System Monitor
function setupSystemMonitorApp(windowEl: HTMLElement, windowData: AppWindow) {
    const cpuFill = windowEl.querySelector('#cpu-usage-fill') as HTMLElement;
    const cpuText = windowEl.querySelector('#cpu-usage-text') as HTMLElement;
    const memFill = windowEl.querySelector('#memory-usage-fill') as HTMLElement;
    const memText = windowEl.querySelector('#memory-usage-text') as HTMLElement;

    const monitorState: SystemMonitorState = { cpuHistory: [], memoryHistory: [] };
    windowData.appSpecificState = monitorState;

    const updateGraphs = () => {
        const cpuUsage = Math.floor(Math.random() * 70 + 10 + state.windows.size * 2); 
        const memUsage = Math.floor(Math.random() * 50 + 20 + state.windows.size * 5);

        cpuFill.style.width = `${Math.min(100,cpuUsage)}%`;
        cpuText.textContent = `${Math.min(100,cpuUsage)}%`;
        cpuFill.classList.toggle('high', cpuUsage > 80);
        (cpuFill.parentElement as HTMLElement).setAttribute('aria-valuenow', String(Math.min(100,cpuUsage)));


        memFill.style.width = `${Math.min(100,memUsage)}%`;
        memText.textContent = `${Math.min(100,memUsage)}%`;
        memFill.classList.toggle('high', memUsage > 75);
        (memFill.parentElement as HTMLElement).setAttribute('aria-valuenow', String(Math.min(100,memUsage)));
    };
    
    monitorState.updateIntervalId = window.setInterval(() => {
        updateGraphs();
        updateSystemMonitorProcessList(); 
    }, 1500);
    updateGraphs(); 
    updateSystemMonitorProcessList(); 
}
function updateSystemMonitorProcessList() {
    const sysMonWindow = Array.from(state.windows.values()).find(win => win.baseAppId === 'SystemMonitor');
    if (sysMonWindow && sysMonWindow.isOpen && !sysMonWindow.isMinimized) { 
        const processListEl = sysMonWindow.element.querySelector('#process-list') as HTMLUListElement;
        if (processListEl) {
            processListEl.innerHTML = ''; 
            state.windows.forEach(win => {
                if (win.isOpen) { 
                    const li = document.createElement('li');
                    li.textContent = `${win.title} (ID: ${win.id.substring(0, 8)})${win.isMinimized ? ' [minimized]' : ''}`;
                    processListEl.appendChild(li);
                }
            });
        }
    }
}

// Matrix Rain App
function setupMatrixRainApp(windowEl: HTMLElement, windowData: AppWindow) {
    const canvas = windowEl.querySelector('#matrix-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const matrixState: MatrixRainState = { canvasCtx: ctx, fontSize: 14 };
    windowData.appSpecificState = matrixState;

    const resizeCanvas = () => {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        matrixState.columns = Math.floor(canvas.width / matrixState.fontSize!);
        matrixState.drops = [];
        for (let x = 0; x < matrixState.columns; x++) matrixState.drops[x] = 1;
    };
    
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(windowEl); 
    resizeCanvas(); 

    const katakana = 'アカサタナハマヤラワガザダバパイキシチニヒミリギジヂビピウクスツヌフムユルグズヅブプエケセテネヘメレゲゼデベペオコソトノホモヨログゾドボポ';
    const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    const characters = katakana + latin + nums;

    function drawMatrix() {
        if (!windowData.isOpen) { 
            if (matrixState.animationFrameId) cancelAnimationFrame(matrixState.animationFrameId);
            observer.unobserve(windowEl); 
            return;
        }
        matrixState.canvasCtx!.fillStyle = 'rgba(0, 0, 0, 0.05)';
        matrixState.canvasCtx!.fillRect(0, 0, canvas.width, canvas.height);
        matrixState.canvasCtx!.fillStyle = '#0F0'; 
        matrixState.canvasCtx!.font = matrixState.fontSize + 'px monospace';

        for (let i = 0; i < matrixState.drops!.length; i++) {
            const text = characters.charAt(Math.floor(Math.random() * characters.length));
            matrixState.canvasCtx!.fillText(text, i * matrixState.fontSize!, matrixState.drops![i] * matrixState.fontSize!);
            if (matrixState.drops![i] * matrixState.fontSize! > canvas.height && Math.random() > 0.975) matrixState.drops![i] = 0;
            matrixState.drops![i]++;
        }
        matrixState.animationFrameId = requestAnimationFrame(drawMatrix);
    }
    drawMatrix();
}

// Credits App
function setupCreditsApp(windowEl: HTMLElement, windowData: AppWindow) {
    // Animation is handled by CSS
}

// About Wiqnnc_ App
function setupAboutWiqnncApp(windowEl: HTMLElement) {
    const osVersionEl = windowEl.querySelector('#about-os-version') as HTMLElement;
    if (osVersionEl) {
        osVersionEl.innerHTML = `<strong>${OS_NAME} Version:</strong> ${OS_VERSION}`; 
        if(!(osVersionEl as any)._versionPopupAttached) {
            setupVersionClickPopupsForElement(osVersionEl); 
            (osVersionEl as any)._versionPopupAttached = true;
        }
    }
}
function setupVersionClickPopupsForElement(el: HTMLElement) {
    el.addEventListener('click', (e) => {
        const message = (el as HTMLElement).dataset.versionPopup || `${OS_NAME}!`;
        versionTooltip.textContent = message;
        
        const rect = el.getBoundingClientRect();
        versionTooltip.style.top = `${rect.top - versionTooltip.offsetHeight - 5}px`;
        versionTooltip.style.left = `${rect.left + rect.width / 2 - versionTooltip.offsetWidth / 2}px`;
        versionTooltip.classList.add('visible');
        versionTooltip.style.display = 'block'; 

        if(state.versionTooltipTimeout) window.clearTimeout(state.versionTooltipTimeout);
        state.versionTooltipTimeout = window.setTimeout(() => {
            versionTooltip.classList.remove('visible');
            window.setTimeout(() => versionTooltip.style.display = 'none', 150);
        }, 2000);
    });
    el.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            (el as HTMLElement).click();
        }
    });
}

// W-Browse App
const W_BROWSE_HOME_CONTENT_SRC = `
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif; 
            margin:0; padding: 30px; text-align: center; 
            color: #333; background-color: #f4f4f4; 
            height: 100%; box-sizing: border-box; display: flex; 
            flex-direction: column; align-items: center; justify-content: center;
        }
        body.dark-theme { color: #eee; background-color: #2c2c2c; }
        h2 { color: #007AFF; font-size: 2.5em; margin-bottom: 10px; }
        body.dark-theme h2 { color: #0A84FF; }
        p { font-size: 1.2em; margin-bottom: 20px; line-height: 1.6; }
        code { background-color: #e0e0e0; padding: 2px 5px; border-radius: 4px; font-family: monospace; }
        body.dark-theme code { background-color: #444; }
        hr { margin: 30px auto; width: 50%; border: 0; border-top: 1px solid #ccc; }
        body.dark-theme hr { border-top: 1px solid #555; }
    </style>
    <body>
        <h2>🌐 W-Browse</h2>
        <p>Welcome to your window to the web, from within ${OS_NAME}!</p>
        <p>Type a URL in the address bar above and press 'Go' or Enter to start exploring.</p>
        <hr>
        <p style="font-size: 0.9em; color: #555;">
            <strong style="color: #222;">Please Note:</strong> Due to web security policies (like <code>X-Frame-Options</code>),
            many websites (e.g., Google, YouTube, Facebook, GitHub) may not load correctly or at all inside W-Browse.
            This is a standard browser behavior designed to protect websites.
            You might see a blank page or an error message from the site itself.
        </p>
        <p style="font-size: 0.8em; color: #777; margin-top: 20px;">Happy (experimental) browsing! ✨</p>
        <script> 
            // Apply dark theme if parent has it
            if (window.parent && window.parent.document.body.classList.contains('dark-theme')) {
                document.body.classList.add('dark-theme');
            }
        <\/script>
    </body>`;


function navigateToUrlInWBrowse(windowData: AppWindow, urlOrContent: string, isNavigatingHistory = false, isHome = false) {
    const browserState = windowData.appSpecificState as WBrowseState;
    if (!browserState || !browserState.iframeEl || !browserState.urlInputEl || !browserState.messageAreaEl) return;

    browserState.currentLoadingUrl = isHome ? 'internal:home' : urlOrContent;
    browserState.messageAreaEl.style.display = 'none';
    browserState.messageAreaEl.textContent = '';

    if (isHome) {
        browserState.iframeEl.srcdoc = W_BROWSE_HOME_CONTENT_SRC;
        browserState.urlInputEl.value = 'W-Browse Home';
    } else {
        browserState.iframeEl.srcdoc = ''; // Clear srcdoc before setting src for external sites
        let urlToLoad = urlOrContent;
        if (!urlToLoad.match(/^([a-z]+:)?\/\//i) && !urlToLoad.startsWith('data:') && !urlToLoad.startsWith('about:')) {
            urlToLoad = 'https://' + urlToLoad;
        }
        browserState.iframeEl.src = urlToLoad;
        browserState.urlInputEl.value = urlToLoad;

        const blockedDomains = ['google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'github.com', 'instagram.com', 'wikipedia.org', 'linkedin.com'];
        try {
            if (!urlToLoad.startsWith('data:') && !urlToLoad.startsWith('about:')) {
                const hostname = new URL(urlToLoad).hostname.replace(/^www\./, '');
                if (blockedDomains.some(domain => hostname.includes(domain))) {
                     browserState.messageAreaEl.textContent = `Note: Sites like '${hostname}' often block being embedded. It might not load as expected.`;
                     browserState.messageAreaEl.style.display = 'block';
                }
            }
        } catch (e) { /* Invalid URL likely, iframe will handle it */ }
    }

    if (!isNavigatingHistory) {
        if (browserState.currentIndex < browserState.history.length - 1) {
            browserState.history = browserState.history.slice(0, browserState.currentIndex + 1);
        }
        browserState.history.push(browserState.currentLoadingUrl);
        browserState.currentIndex = browserState.history.length - 1;
    }
    
    const backButton = windowData.element.querySelector('.w-browse-back') as HTMLButtonElement;
    const forwardButton = windowData.element.querySelector('.w-browse-forward') as HTMLButtonElement;
    if(backButton) backButton.disabled = browserState.currentIndex <= 0;
    if(forwardButton) forwardButton.disabled = browserState.currentIndex >= browserState.history.length - 1;
}


function setupWBrowseApp(windowEl: HTMLElement, windowData: AppWindow) {
    const browserState: WBrowseState = {
        history: [],
        currentIndex: -1,
        iframeEl: windowEl.querySelector('.w-browse-iframe') as HTMLIFrameElement,
        urlInputEl: windowEl.querySelector('.w-browse-url-input') as HTMLInputElement,
        messageAreaEl: windowEl.querySelector('.w-browse-message-area') as HTMLElement,
        initialUrl: windowData.appSpecificState?.initialUrl
    };
    windowData.appSpecificState = browserState;

    const backButton = windowEl.querySelector('.w-browse-back') as HTMLButtonElement;
    const forwardButton = windowEl.querySelector('.w-browse-forward') as HTMLButtonElement;
    const refreshButton = windowEl.querySelector('.w-browse-refresh') as HTMLButtonElement;
    const homeButton = windowEl.querySelector('.w-browse-home') as HTMLButtonElement;
    const goButton = windowEl.querySelector('.w-browse-go-button') as HTMLButtonElement;

    browserState.iframeEl!.onload = () => {
        if (browserState.messageAreaEl && browserState.currentLoadingUrl && browserState.currentLoadingUrl !== 'internal:home') {
            try {
                if (browserState.iframeEl?.contentWindow?.location.href === 'about:blank' && 
                    !browserState.currentLoadingUrl.startsWith('about:blank')) {
                     browserState.messageAreaEl.textContent = `Could not load ${browserState.urlInputEl?.value || browserState.currentLoadingUrl}. The site may block embedding or the URL is invalid.`;
                     browserState.messageAreaEl.style.display = 'block';
                }
            } catch (e) { /* Cross-origin access error */ }
        }
    };
     browserState.iframeEl!.onerror = () => {
        if (browserState.messageAreaEl && browserState.currentLoadingUrl && browserState.currentLoadingUrl !== 'internal:home') {
            browserState.messageAreaEl.textContent = `Error loading ${browserState.urlInputEl?.value || browserState.currentLoadingUrl}. The site might be down or unreachable.`;
            browserState.messageAreaEl.style.display = 'block';
        }
    };

    const loadFromInput = () => {
        let url = browserState.urlInputEl!.value.trim();
        if (url) { navigateToUrlInWBrowse(windowData, url); }
    };

    goButton.onclick = loadFromInput;
    browserState.urlInputEl!.onkeypress = (e) => { if (e.key === 'Enter') loadFromInput(); };

    backButton.onclick = () => {
        if (browserState.currentIndex > 0) {
            browserState.currentIndex--;
            const historyUrl = browserState.history[browserState.currentIndex];
            navigateToUrlInWBrowse(windowData, historyUrl, true, historyUrl === 'internal:home');
        }
    };
    forwardButton.onclick = () => {
        if (browserState.currentIndex < browserState.history.length - 1) {
            browserState.currentIndex++;
            const historyUrl = browserState.history[browserState.currentIndex];
            navigateToUrlInWBrowse(windowData, historyUrl, true, historyUrl === 'internal:home');
        }
    };
    refreshButton.onclick = () => {
        if (browserState.iframeEl) {
            const currentHistoryUrl = browserState.history[browserState.currentIndex];
            if (currentHistoryUrl === 'internal:home') {
                navigateToUrlInWBrowse(windowData, currentHistoryUrl, true, true); 
            } else if (browserState.iframeEl.src && browserState.iframeEl.src !== 'about:blank') {
                 try { browserState.iframeEl.contentWindow?.location.reload(); } 
                 catch (e) { browserState.iframeEl.src = browserState.iframeEl.src; } // Fallback reload
            }
        }
    };
    homeButton.onclick = () => navigateToUrlInWBrowse(windowData, 'internal:home', false, true);

    if (browserState.initialUrl) {
        navigateToUrlInWBrowse(windowData, browserState.initialUrl);
    } else {
        navigateToUrlInWBrowse(windowData, 'internal:home', false, true);
    }
}


// App Listeners for W-Browse integration
function setupInteractiveExternalLinks(windowEl: HTMLElement) {
    windowEl.querySelectorAll('a.interactive-external-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = (e.currentTarget as HTMLAnchorElement).href;
            const linkText = (e.currentTarget as HTMLAnchorElement).textContent || url;
            const openInBrowser = confirm(`Open "${linkText}" (${url}) in W-Browse?`);
            if (openInBrowser) {
                openApp('WBrowse', { initialUrl: url });
            }
        });
    });
}

function setupAboutAppListeners(windowEl: HTMLElement) {
    setupInteractiveExternalLinks(windowEl);
}
function setupContactAppListeners(windowEl: HTMLElement) {
    setupInteractiveExternalLinks(windowEl);
    // Handle mock links if any (not present in current HTML for contact but kept for robustness)
    const mockLinks = windowEl.querySelectorAll('.mock-link');
    mockLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = (e.currentTarget as HTMLElement).dataset.url;
            const message = (e.currentTarget as HTMLElement).dataset.message || "This link would typically open in a new tab.";
            if (url) {
                const openInBrowser = confirm(`Open "${url}" in W-Browse?`);
                if(openInBrowser) openApp('WBrowse', { initialUrl: url });
            } else {
                alert(message);
            }
        });
    });
}


// Start Wiqnnc_
init();
