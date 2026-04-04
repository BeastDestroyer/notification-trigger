// ==== STATE MANAGEMENT ====
const STORAGE_KEY = 'offline-task-reminders';

function getTasks() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveTasks(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    renderTasks();
}

function generateId() {
    return Math.random().toString(36).substring(2, 9);
}

// ==== SERVICE WORKER REGISTRATION ====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    });
}

// ==== DOM ELEMENTS ====
const timeDisplay = document.getElementById('date-display');
const greetingDisplay = document.getElementById('greeting');
const addTaskBtn = document.getElementById('add-task-btn');
const taskModal = document.getElementById('task-modal');
const closeBtn = document.getElementById('close-modal-btn');
const taskForm = document.getElementById('task-form');
const notificationBanner = document.getElementById('notification-banner');
const enableNotifsBtn = document.getElementById('enable-notifs-btn');

const upcomingList = document.getElementById('upcoming-list');
const completedList = document.getElementById('completed-list');
const tabs = document.querySelectorAll('.tab');

// Modal Elements
const pills = document.querySelectorAll('.pill');
const customDateInput = document.getElementById('custom-date');
const timeInput = document.getElementById('task-time');
const timeWarning = document.getElementById('time-warning');

// ==== DATE AND TIME UTILS ====
function updateHeaderTime() {
    const now = new Date();
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    timeDisplay.textContent = now.toLocaleDateString('en-US', options) + ' • ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const hour = now.getHours();
    if(hour < 12) greetingDisplay.textContent = 'Good Morning';
    else if(hour < 18) greetingDisplay.textContent = 'Good Afternoon';
    else greetingDisplay.textContent = 'Good Evening';
}

setInterval(updateHeaderTime, 1000);
updateHeaderTime();

// ==== NOTIFICATIONS ENGINE ====
function checkNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        notificationBanner.classList.remove('hidden');
    } else {
        notificationBanner.classList.add('hidden');
    }
}

enableNotifsBtn.addEventListener('click', () => {
    if (!('Notification' in window)) {
        alert("This browser does not support desktop notifications.");
        return;
    }
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            notificationBanner.classList.add('hidden');
            new Notification("Notifications Enabled!", {
                body: "You will now receive task reminders.",
                icon: "icon-192.png"
            });
        }
    });
});

function triggerNotification(task) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Play a standard mobile notification sound
    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-back-2575.mp3');
    audio.play().catch(e => console.log('Audio blocked by browser, interaction needed: ', e));

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(task.title, {
                body: task.description || "Task reminder!",
                icon: 'icon.svg',
                vibrate: [200, 100, 200, 100, 200],
                tag: task.id,
                requireInteraction: true
            });
        });
    } else {
        new Notification(task.title, {
            body: task.description || "Task reminder!",
            icon: 'icon.svg',
            requireInteraction: true
        });
    }
}

// Background scheduler
setInterval(() => {
    let tasks = getTasks();
    let updated = false;
    const now = new Date().getTime();

    tasks = tasks.map(task => {
        if (!task.completed && !task.notified && task.timestamp <= now) {
            triggerNotification(task);
            task.notified = true;
            updated = true;
        }
        return task;
    });

    if (updated) saveTasks(tasks);
}, 5000); // Check every 5 seconds

// ==== UI LOGIC ====
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        if (tab.dataset.tab === 'upcoming') {
            upcomingList.classList.add('active-list');
            upcomingList.classList.remove('hidden-list');
            completedList.classList.add('hidden-list');
            completedList.classList.remove('active-list');
        } else {
            completedList.classList.add('active-list');
            completedList.classList.remove('hidden-list');
            upcomingList.classList.add('hidden-list');
            upcomingList.classList.remove('active-list');
        }
    });
});

addTaskBtn.addEventListener('click', () => {
    taskModal.classList.remove('hidden');
    document.getElementById('task-title').focus();
    // Default to today
    selectPill(pills[0]);
});

closeBtn.addEventListener('click', () => {
    taskModal.classList.add('hidden');
    taskForm.reset();
    timeWarning.classList.add('hidden');
});

// Date Picker Pills Logic
let selectedDateType = 'today';

function selectPill(activePill) {
    pills.forEach(p => p.classList.remove('active'));
    activePill.classList.add('active');
    selectedDateType = activePill.dataset.date;

    if (selectedDateType === 'pick') {
        customDateInput.classList.remove('hidden-input');
        customDateInput.required = true;
    } else {
        customDateInput.classList.add('hidden-input');
        customDateInput.required = false;
    }
    validateTime();
}

pills.forEach(pill => {
    pill.addEventListener('click', () => selectPill(pill));
});

// Time Validation
function validateTime() {
    if (!timeInput.value) return true;
    
    if (selectedDateType === 'today') {
        const now = new Date();
        const inputTime = timeInput.value.split(':');
        const taskTimeToday = new Date();
        taskTimeToday.setHours(parseInt(inputTime[0]), parseInt(inputTime[1]), 0, 0);

        if (taskTimeToday <= now) {
            timeWarning.classList.remove('hidden');
            return false;
        }
    }
    timeWarning.classList.add('hidden');
    return true;
}

timeInput.addEventListener('change', validateTime);
customDateInput.addEventListener('change', validateTime);

// Handle Form Submit
taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateTime()) return; // block submission

    const title = document.getElementById('task-title').value.trim();
    const desc = document.getElementById('task-desc').value.trim();
    const timeVal = timeInput.value;

    let targetDate = new Date();
    if (selectedDateType === 'tomorrow') {
        targetDate.setDate(targetDate.getDate() + 1);
    } else if (selectedDateType === 'pick') {
        const parts = customDateInput.value.split('-');
        targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
    }
    
    const [hours, minutes] = timeVal.split(':');
    targetDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const newTask = {
        id: generateId(),
        title,
        description: desc,
        timestamp: targetDate.getTime(),
        completed: false,
        notified: false
    };

    const tasks = getTasks();
    tasks.push(newTask);
    saveTasks(tasks);

    taskModal.classList.add('hidden');
    taskForm.reset();
});

// Render Tasks
function formatTime(timestamp) {
    const d = new Date(timestamp);
    const timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate()+1);
    
    if (d.toDateString() === today.toDateString()) return `Today, ${timeStr}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${timeStr}`;
    return `${d.toLocaleDateString([], {month:'short', day:'numeric'})}, ${timeStr}`;
}

function renderTasks() {
    const tasks = getTasks();
    const now = new Date().getTime();
    
    let upcomingHTML = '';
    let completedHTML = '';

    const sortedTasks = tasks.sort((a,b) => a.timestamp - b.timestamp);

    sortedTasks.forEach(task => {
        const isOverdue = !task.completed && task.timestamp < now;
        
        const cardHTML = `
            <div class="task-card ${task.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}">
                <div class="checkbox-container">
                    <button class="checkbox-btn" onclick="toggleComplete('${task.id}')" aria-label="Toggle Completion">
                        <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                    </button>
                </div>
                <div class="task-info">
                    <h3 class="task-title">${task.title}</h3>
                    ${task.description ? `<p class="task-desc">${task.description}</p>` : ''}
                    <div class="task-meta">
                        <span class="task-time-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                            ${isOverdue && !task.completed ? 'Overdue • ' : ''}${formatTime(task.timestamp)}
                        </span>
                    </div>
                </div>
                <button class="delete-btn" onclick="deleteTask('${task.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>
        `;

        if (task.completed) completedHTML += cardHTML;
        else upcomingHTML += cardHTML;
    });

    if (upcomingHTML === '') upcomingHTML = `<div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
        <p>No upcoming reminders. Enjoy your day!</p>
    </div>`;
    
    if (completedHTML === '') completedHTML = `<div class="empty-state"><p>No completed tasks yet.</p></div>`;

    upcomingList.innerHTML = upcomingHTML;
    completedList.innerHTML = completedHTML;
}

// Global scope for onclick handlers
window.toggleComplete = function(id) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === id);
    if(task) {
        task.completed = !task.completed;
        saveTasks(tasks);
    }
};

window.deleteTask = function(id) {
    if(confirm("Delete this reminder?")) {
        const tasks = getTasks().filter(t => t.id !== id);
        saveTasks(tasks);
    }
};

// Initialize
checkNotificationPermission();
renderTasks();
