/* ============================================================================
   INTELLIGENT TRAFFIC CONTROL DASHBOARD - LOGIC (JavaScript)
   
   EDUCATIONAL ARCHITECTURE:
   This module demonstrates advanced JavaScript concepts:
   - State Management with Object-Oriented Design
   - Asynchronous Programming (Promises & async/await)
   - Event Loop & Call Stack Understanding
   - Race Condition Prevention with Mutexes
   - DOM Manipulation with querySelector & classList
   
   CONTROL FLOW:
   1. init() → Initializes system state & event listeners
   2. Event Listener → User clicks button or system event triggered
   3. handleLogic() → Check race conditions & queue state
   4. transitionLights() → Execute state machine transitions
   5. updateUI() → Reflect new state in DOM
   6. Log() → Document all changes
   
   EVENT LOOP INSIGHT:
   - User interactions are macrotasks (click events)
   - Promise resolution (.then, async/await) are microtasks
   - Microtasks execute BEFORE the next macrotask
   - This ensures state consistency before user can click again
   ============================================================================ */

/* ============================================================================
   PART 1: STATE MANAGEMENT - Central Traffic System State Machine
   ============================================================================ */

/**
 * TRAFFIC SYSTEM STATE OBJECT
 * 
 * This object holds the complete state of our traffic control system.
 * It tracks two intersections: North-South (NS) and East-West (EW).
 * 
 * Why use an object for state?
 * - Single source of truth for all traffic data
 * - Easy to serialize/debug
 * - Prevents global variable pollution
 * - Enables undo/redo capabilities (not implemented, but architecture allows it)
 */
const trafficSystem = {
    // ========================================================================
    // INTERSECTION STATES
    // Each intersection has: state (RED/YELLOW/GREEN), duration (in seconds)
    // ========================================================================
    northSouth: {
        state: 'RED',      // Current light color
        duration: 0,       // How long in current state (seconds)
        timerInterval: null // Reference to interval for cleanup
    },
    
    eastWest: {
        state: 'GREEN',    // Current light color
        duration: 0,       // How long in current state (seconds)
        timerInterval: null // Reference to interval for cleanup
    },
    
    // ========================================================================
    // TRANSITION CONTROL - Race Condition Prevention
    // ========================================================================
    isTransitioning: false,      // Mutex: Prevents simultaneous transitions
    transitionQueue: [],         // Queue: Stores pending transition requests
    
    // ========================================================================
    // TIMING CONSTANTS - Configurable durations
    // ========================================================================
    timings: {
        greenDuration: 10,      // Green light stays on for 10 seconds
        yellowDuration: 3,      // Yellow light duration (safety buffer)
        redDuration: 1,         // Minimum red before opposite light turns green
        transitionDelay: 100    // Delay between light changes (animation smoothing)
    },
    
    // ========================================================================
    // LOGGING & HISTORY
    // ========================================================================
    logs: [],                   // Array of system events for audit trail
    startTime: Date.now(),      // System start timestamp for relative logging
};

/* ============================================================================
   PART 2: UTILITY FUNCTIONS - Logging & Time Helpers
   ============================================================================ */

/**
 * GET ELAPSED TIME
 * Returns the time since system initialization in HH:MM:SS format.
 * 
 * Event Loop Context:
 * - This is a synchronous function (no async/await)
 * - Executes in the call stack immediately
 * - Used in logging (microtask execution)
 */
function getElapsedTime() {
    const elapsed = Math.floor((Date.now() - trafficSystem.startTime) / 1000);
    const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const seconds = String(elapsed % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * ADD LOG ENTRY
 * Appends a new event to the system logs.
 * 
 * Purpose: Provides a complete audit trail of all state transitions.
 * This helps with debugging race conditions and understanding system behavior.
 * 
 * @param {string} message - Description of the event
 * @param {string} type - 'info', 'warning', or 'error'
 */
function addLog(message, type = 'info') {
    const entry = {
        time: getElapsedTime(),
        message: message,
        type: type,
        timestamp: Date.now()
    };
    
    // Simulate queue - logs are also subject to timing
    trafficSystem.logs.push(entry);
    
    // Keep only last 50 logs to prevent memory bloat
    if (trafficSystem.logs.length > 50) {
        trafficSystem.logs.shift(); // Remove oldest log
    }
}

/* ============================================================================
   PART 3: DOM UPDATE FUNCTIONS - Reflects state in HTML
   ============================================================================ */

/**
 * UPDATE UI - Central rendering function
 * 
 * This function is the ONLY place where DOM manipulation occurs.
 * All changes propagate through updateUI() after state changes.
 * 
 * Single Responsibility Principle:
 * - Reads from trafficSystem state
 * - Updates DOM elements
 * - Does NOT modify state
 * 
 * Performance Note:
 * We use document.querySelector (simpler) over getElementByID
 * but both have O(1) to O(n) complexity depending on implementation.
 * 
 * Event Loop Context:
 * - DOM updates trigger a repaint/reflow (browser microtask)
 * - This happens AFTER our JavaScript execution
 * - Visual changes appear to be instant to the user
 */
function updateUI() {
    // ========================================================================
    // 1. UPDATE TRAFFIC LIGHT STATES (RED, YELLOW, GREEN)
    // ========================================================================
    
    updateTrafficLight('ns', trafficSystem.northSouth);
    updateTrafficLight('ew', trafficSystem.eastWest);
    
    // ========================================================================
    // 2. UPDATE TEXT DISPLAY (Current state & duration)
    // ========================================================================
    
    // North-South text updates
    document.querySelector('#ns-state').textContent = trafficSystem.northSouth.state;
    document.querySelector('#ns-duration').textContent = `${trafficSystem.northSouth.duration}s`;
    
    // East-West text updates
    document.querySelector('#ew-state').textContent = trafficSystem.eastWest.state;
    document.querySelector('#ew-duration').textContent = `${trafficSystem.eastWest.duration}s`;
    
    // ========================================================================
    // 3. UPDATE SYSTEM STATUS INDICATORS
    // ========================================================================
    
    const statusIndicator = document.querySelector('#system-status');
    if (trafficSystem.isTransitioning) {
        statusIndicator.textContent = '🟡 TRANSITIONING';
        statusIndicator.className = 'status-indicator busy';
    } else {
        statusIndicator.textContent = '🟢 READY';
        statusIndicator.className = 'status-indicator';
    }
    
    // Update queue count display
    document.querySelector('#queue-count').textContent = trafficSystem.transitionQueue.length;
    
    // ========================================================================
    // 4. UPDATE SYSTEM LOGS DISPLAY
    // ========================================================================
    
    updateLogsDisplay();
}

/**
 * UPDATE TRAFFIC LIGHT - Helper for individual intersection lights
 * 
 * Uses classList.toggle for efficient DOM updates.
 * The 'active' class enables the CSS animations and glow effects.
 * 
 * @param {string} intersection - 'ns' for North-South, 'ew' for East-West
 * @param {object} state - The traffic state object for this intersection
 */
function updateTrafficLight(intersection, state) {
    // Get the light elements for this intersection
    const redLight = document.querySelector(`#${intersection}-red`);
    const yellowLight = document.querySelector(`#${intersection}-yellow`);
    const greenLight = document.querySelector(`#${intersection}-green`);
    
    // Remove 'active' class from all lights first
    redLight.classList.remove('active');
    yellowLight.classList.remove('active');
    greenLight.classList.remove('active');
    
    // Add 'active' class to the appropriate light
    // classList.toggle removes if present, adds if absent
    // We use direct assignment here for clarity
    switch(state.state) {
        case 'RED':
            redLight.classList.add('active');
            break;
        case 'YELLOW':
            yellowLight.classList.add('active');
            break;
        case 'GREEN':
            greenLight.classList.add('active');
            break;
    }
}

/**
 * UPDATE LOGS DISPLAY - Renders all system logs to the sidebar
 * 
 * This creates dynamic HTML elements for each log entry.
 * In production, you'd use a virtual list for 1000+ logs.
 * 
 * DOM Efficiency:
 * - We rebuild the entire log panel (not ideal, but simple)
 * - For large lists, use DocumentFragment or virtual scrolling
 * - Current approach is fine for 50 logs
 */
function updateLogsDisplay() {
    const logsContainer = document.querySelector('#logs-container');
    
    // Create HTML for each log entry
    const logsHTML = trafficSystem.logs.map(log => {
        return `<div class="log-entry ${log.type}">
                    <span class="log-time">[${log.time}]</span>
                    <span class="log-message">${log.message}</span>
                </div>`;
    }).join('');
    
    logsContainer.innerHTML = logsHTML;
    
    // Auto-scroll to bottom to show newest logs
    // This happens in the next animation frame (browser's responsibility)
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

/* ============================================================================
   PART 4: RACE CONDITION PROTECTION - The Mutex Pattern
   ============================================================================ */

/**
 * IS TRANSITION SAFE - Checks if we can safely perform a transition
 * 
 * RACE CONDITION EXPLANATION:
 * A race condition occurs when multiple async operations modify state
 * without proper synchronization.
 * 
 * Example of bad code (UNSAFE):
 * ```javascript
 * async function badTransition() {
 *     // DANGER: Two calls to this function could both think isTransitioning=false
 *     if (trafficSystem.isTransitioning) return; // Check at time=0ms
 *     // ... time passes, another call starts here
 *     trafficSystem.isTransitioning = true;
 *     await delay(3000);
 *     trafficSystem.isTransitioning = false; // Both instances do this!
 * }
 * ```
 * 
 * Our solution: Set the mutex BEFORE any async operation
 * 
 * CONTROL FLOW (Synchronous part):
 * 1. Check if already transitioning (atomic read)
 * 2. If YES: queue the request (happens immediately)
 * 3. If NO: set isTransitioning = true (atomic write)
 * 4. Then execute async transition
 * 
 * @returns {boolean} True if safe to transition, false if already transitioning
 */
function isTransitionSafe() {
    if (trafficSystem.isTransitioning) {
        // Already transitioning, queue this request for later
        trafficSystem.transitionQueue.push(true);
        addLog('⚠️ Transition queued (system busy)', 'warning');
        return false;
    }
    // Safe to transition, claim the lock
    trafficSystem.isTransitioning = true;
    return true;
}

/**
 * RELEASE TRANSITION LOCK - Enables the next queued transition
 * 
 * This is called at the END of transitionLights() after all async operations.
 * It must be the last thing in the function to prevent race conditions.
 * 
 * Event Loop Insight:
 * When we call transitionLights() again from here, it creates a new
 * entry on the CALL STACK, separate from the completed transition.
 * This ensures clean state separation.
 */
async function releaseTransitionLock() {
    trafficSystem.isTransitioning = false;
    
    // If there are queued requests, process the next one
    if (trafficSystem.transitionQueue.length > 0) {
        trafficSystem.transitionQueue.shift(); // Remove from queue
        addLog('⏭️ Processing next queued transition', 'info');
        
        // Process on next tick to avoid call stack buildup
        // This uses the event loop's macrotask queue
        setTimeout(() => handleLogic(), 50);
    }
    
    updateUI(); // Reflect updated status (no queue or "busy" indicator)
}

/* ============================================================================
   PART 5: STATE MACHINE LOGIC - The Traffic Light Transitions
   ============================================================================ */

/**
 * HANDLE LOGIC - Entry point for state machine transitions
 * 
 * This function decides which intersection should go next based on
 * the current state. It implements the actual traffic control logic.
 * 
 * TRAFFIC LOGIC:
 * - If NS is GREEN → switch to EW (after yellow buffer)
 * - If EW is GREEN → switch to NS (after yellow buffer)
 * - If both RED → one must go GREEN
 * 
 * If a user clicks during transition:
 * - isTransitionSafe() will queue it
 * - releaseTransitionLock() will process the queue
 * 
 * @returns {Promise<void>}
 */
async function handleLogic() {
    // Check if safe to start a transition
    if (!isTransitionSafe()) {
        return; // Already transitioning, we've been queued
    }
    
    // Determine which light should transition next
    // Current logic: Switch from whoever is currently green
    if (trafficSystem.northSouth.state === 'GREEN') {
        addLog('🔄 NS → Green detected. Starting transition EW.', 'info');
        await transitionLights('NS');
    } else if (trafficSystem.eastWest.state === 'GREEN') {
        addLog('🔄 EW → Green detected. Starting transition NS.', 'info');
        await transitionLights('EW');
    } else {
        // Both red (should only happen at init), NS goes green
        addLog('🔄 Both RED. Prioritizing NS → GREEN.', 'info');
        await transitionLights('NS');
    }
    
    // Release the transition lock and process queue
    await releaseTransitionLock();
}

/**
 * TRANSITION LIGHTS - The Core Async State Machine
 * 
 * This is the HEART of the system. It handles the complex timing of:
 * 1. Turning current green light YELLOW
 * 2. Waiting 3 seconds (safety buffer)
 * 3. Turning YELLOW light RED
 * 4. Waiting 1 second (safety buffer)
 * 5. Turning NEXT light GREEN
 * 
 * ASYNC/AWAIT EXPLANATION:
 * - async keyword means this function returns a Promise
 * - await keyword pauses execution until Promise resolves
 * - While awaiting, other code can run (non-blocking!)
 * - This is why we can handle multiple interactions smoothly
 * 
 * PROMISE CHAIN CONCEPT:
 * This function creates a chain of Promises:
 * delay(100) -> change to YELLOW -> delay(3000) -> change to RED -> ...
 * 
 * @param {string} fromIntersection - Which light is currently green ('NS' or 'EW')
 * @returns {Promise<void>}
 */
async function transitionLights(fromIntersection) {
    // Determine current and next intersection
    const currentState = fromIntersection === 'NS' ? trafficSystem.northSouth : trafficSystem.eastWest;
    const nextState = fromIntersection === 'NS' ? trafficSystem.eastWest : trafficSystem.northSouth;
    const nextIntersection = fromIntersection === 'NS' ? 'EW' : 'NS';
    
    try {
        // ====================================================================
        // PHASE 1: GREEN → YELLOW (Change immediately, with animation delay)
        // ====================================================================
        
        addLog(`⏱️ ${fromIntersection} going YELLOW (3s safety buffer)...`, 'info');
        
        // Small delay for smooth CSS animation
        await delay(trafficSystem.timings.transitionDelay);
        
        currentState.state = 'YELLOW';
        currentState.duration = trafficSystem.timings.yellowDuration;
        updateUI();
        
        // ====================================================================
        // PHASE 2: YELLOW LIGHT WAIT (3 seconds - allows cars to clear)
        // ====================================================================
        
        // Countdown timer: Show remaining time in UI
        await new Promise((resolve) => {
            let remaining = trafficSystem.timings.yellowDuration;
            
            // Update every second while waiting
            const yellowInterval = setInterval(() => {
                remaining--;
                currentState.duration = remaining;
                updateUI();
                
                if (remaining <= 0) {
                    clearInterval(yellowInterval);
                    resolve();
                }
            }, 1000);
            
            // Store interval ID for cleanup (in case of reset)
            currentState.timerInterval = yellowInterval;
        });
        
        // ====================================================================
        // PHASE 3: YELLOW → RED
        // ====================================================================
        
        addLog(`🛑 ${fromIntersection} turning RED. Waiting 1s for clearance...`, 'info');
        
        currentState.state = 'RED';
        currentState.duration = trafficSystem.timings.redDuration;
        updateUI();
        
        // ====================================================================
        // PHASE 4: RED LIGHT WAIT (1 second - safety margin)
        // ====================================================================
        
        // Wait before next light turns green (prevents collisions)
        await delay(trafficSystem.timings.redDuration * 1000);
        
        // ====================================================================
        // PHASE 5: OPPOSITE → GREEN (Activate next intersection)
        // ====================================================================
        
        addLog(`🟢 ${nextIntersection} turning GREEN for ${trafficSystem.timings.greenDuration}s...`, 'info');
        
        nextState.state = 'GREEN';
        nextState.duration = trafficSystem.timings.greenDuration;
        updateUI();
        
        // ====================================================================
        // PHASE 6: GREEN LIGHT HOLD (10 seconds - traffic flows)
        // ====================================================================
        
        // Countdown timer for next light
        await new Promise((resolve) => {
            let remaining = trafficSystem.timings.greenDuration;
            
            const greenInterval = setInterval(() => {
                remaining--;
                nextState.duration = remaining;
                updateUI();
                
                if (remaining <= 0) {
                    clearInterval(greenInterval);
                    resolve();
                }
            }, 1000);
            
            nextState.timerInterval = greenInterval;
        });
        
        addLog(`✅ ${nextIntersection} GREEN cycle complete.`, 'info');
        
    } catch (error) {
        addLog(`❌ Error in transition: ${error.message}`, 'error');
        console.error('Transition error:', error);
    }
}

/**
 * DELAY - Promise-based delay helper
 * 
 * This is the key to non-blocking async behavior!
 * 
 * How it works:
 * - Returns a Promise that resolves after N milliseconds
 * - setTimeout puts the resolution in the event loop's macrotask queue
 * - JavaScript continues executing other code while waiting
 * - When timer fires, the Promise resolves (microtask)
 * - Any code awaiting this Promise continues
 * 
 * EVENT LOOP DIAGRAM:
 * 
 * Start: delay(1000) called
 *   ↓
 * [Call Stack] → delay() returns Promise immediately
 *   ↓
 * [Script continues] → Can handle user clicks
 *   ↓
 * [Event Loop MacTask Queue] → setTimeout callback fires after 1000ms
 *   ↓
 * [Microtask Queue] → Promise resolves
 *   ↓
 * [Call Stack] → Code after await resumes
 * 
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/* ============================================================================
   PART 6: EVENT HANDLERS - User Interaction Entry Points
   ============================================================================ */

/**
 * TRIGGER SWITCH - Called when user clicks "Switch Lights" button
 * 
 * CONTROL FLOW:
 * 1. User clicks button (browser event)
 * 2. handleLogic() called (sync, returns immediately)
 * 3. If not transitioning: transitionLights() starts (async)
 * 4. Rest of transition happens asynchronously
 * 5. After transition: releaseTransitionLock() processes queue
 * 
 * User Experience:
 * Even though transition takes ~14 seconds, UI is responsive because
 * we're using async/await and Promises. User can click button anytime.
 * 
 * @event click
 */
function handleSwitchClick() {
    addLog('🖱️ User clicked Switch Lights button', 'info');
    handleLogic(); // This is async, but we don't await here
    updateUI();    // Show immediate feedback
}

/**
 * RESET SYSTEM - Resets traffic system to initial state
 * 
 * This function demonstrates cleanup and proper state management:
 * 1. Clear any running timers to prevent memory leaks
 * 2. Reset all state values
 * 3. Clear the transition lock
 * 4. Clear any queued transitions
 * 5. Update UI to reflect clean state
 * 
 * @event click
 */
function handleReset() {
    addLog('🔄 System RESET initiated', 'warning');
    
    // Clear any running interval timers
    // These were set in transitionLights() countdown loops
    if (trafficSystem.northSouth.timerInterval) {
        clearInterval(trafficSystem.northSouth.timerInterval);
    }
    if (trafficSystem.eastWest.timerInterval) {
        clearInterval(trafficSystem.eastWest.timerInterval);
    }
    
    // Reset state to initial configuration
    trafficSystem.northSouth = {
        state: 'RED',
        duration: 0,
        timerInterval: null
    };
    
    trafficSystem.eastWest = {
        state: 'GREEN',
        duration: 0,
        timerInterval: null
    };
    
    // Clear transition queue and lock
    trafficSystem.isTransitioning = false;
    trafficSystem.transitionQueue = [];
    trafficSystem.logs = [];
    
    // Add reset log
    addLog('✅ System reset to initial state', 'warning');
    
    updateUI();
}

/**
 * CLEAR LOGS - Clears the system log display
 * 
 * @event click
 */
function handleClearLogs() {
    trafficSystem.logs = [];
    addLog('🗑️ Logs cleared', 'info');
    updateUI();
}

/* ============================================================================
   PART 7: INITIALIZATION - System Setup & Event Delegation
   ============================================================================ */

/**
 * INIT - Initializes the entire system
 * 
 * This runs once when the page loads. It:
 * 1. Sets up all event listeners
 * 2. Performs initial UI render
 * 3. Logs initialization complete
 * 
 * EVENT DELEGATION PATTERN:
 * Rather than adding listeners to many elements, we add to the window
 * and let events bubble. This is more efficient for dynamic content.
 * 
 * Runs on: DOMContentLoaded event
 * This ensures the DOM is fully loaded before we manipulate it
 */
function init() {
    console.log('🚀 Initializing Traffic Control System...');
    
    // ========================================================================
    // 1. GET DOM ELEMENT REFERENCES
    // ========================================================================
    
    const switchBtn = document.querySelector('#trigger-switch-btn');
    const resetBtn = document.querySelector('#reset-btn');
    const clearLogsBtn = document.querySelector('#clear-logs-btn');
    
    // ========================================================================
    // 2. ATTACH EVENT LISTENERS
    // ========================================================================
    
    // Switch button: Trigger light transition
    switchBtn.addEventListener('click', handleSwitchClick);
    
    // Reset button: Return to initial state
    resetBtn.addEventListener('click', handleReset);
    
    // Clear logs button
    clearLogsBtn.addEventListener('click', handleClearLogs);
    
    // Keyboard shortcut accessibility (Space = Switch)
    // This demonstrates event delegation to the document
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space' && event.target === document.body) {
            event.preventDefault();
            handleSwitchClick();
        }
    });
    
    // ========================================================================
    // 3. INITIAL STATE UPDATE & LOGGING
    // ========================================================================
    
    addLog('🟢 System initialized. NS: RED, EW: GREEN', 'info');
    updateUI();
    
    console.log('✅ System ready. Waiting for user interaction...');
}

/* ============================================================================
   PART 8: BOOTSTRAP - Window Load Event
   ============================================================================ */

/**
 * DOMCONTENTLOADED EVENT LISTENER
 * 
 * Why use DOMContentLoaded instead of window.onload?
 * 
 * DOMContentLoaded fires when DOM is parsed (before images load)
 * window.onload waits for all images, stylesheets, etc.
 * 
 * For optimal perceived performance, we use DOMContentLoaded
 * because we don't need images to set up JavaScript state.
 * 
 * EVENT LOOP CONTEXT:
 * When the browser fires DOMContentLoaded:
 * 1. All synchronous JavaScript is parsed and executed
 * 2. This calls init()
 * 3. init() sets up listeners (queued in event loop)
 * 4. init() calls updateUI() (triggers layout recalculation)
 * 5. Browser repaints (browser's responsibility)
 * 6. Event loop waits for user interaction
 */
document.addEventListener('DOMContentLoaded', init);

// Alternative: Auto-start the system (optional, uncomment to enable)
// This would start the traffic light cycle automatically
// document.addEventListener('DOMContentLoaded', () => {
//     init();
//     setTimeout(() => handleLogic(), 1000); // Start blinking after 1 second
// });

/* ============================================================================
   END OF LOGIC MODULE
   ============================================================================ */
