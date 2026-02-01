// Application State
const state = {
    currentPhase: 1,
    myPeerId: null,
    isHost: false,
    peer: null,
    connections: [],
    participants: [], // Will now store objects: {username, peerId, role}
    cards: [],
    groups: [],
    votes: {},
    myVotesRemaining: 3,
    actionItems: [],
    username: `User${Math.floor(Math.random() * 10000)}`,
    myRole: 'participant' // moderator, participant, or guest
};

// Utility Functions
function generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Caesar cipher for card text encryption (shift by 2)
// Note: This provides minimal obfuscation, not real security.
// The purpose is to prevent casual viewing in Phase 1, not to protect against
// determined attackers. For production use with sensitive data, consider using
// Web Crypto API with AES encryption.
function encryptText(text) {
    return text.split('').map(char => {
        const code = char.charCodeAt(0);
        // Handle lowercase letters
        if (code >= 97 && code <= 122) {
            return String.fromCharCode(((code - 97 + 2) % 26) + 97);
        }
        // Handle uppercase letters
        if (code >= 65 && code <= 90) {
            return String.fromCharCode(((code - 65 + 2) % 26) + 65);
        }
        // Return other characters as-is
        return char;
    }).join('');
}

function decryptText(text) {
    return text.split('').map(char => {
        const code = char.charCodeAt(0);
        // Handle lowercase letters
        if (code >= 97 && code <= 122) {
            return String.fromCharCode(((code - 97 - 2 + 26) % 26) + 97);
        }
        // Handle uppercase letters
        if (code >= 65 && code <= 90) {
            return String.fromCharCode(((code - 65 - 2 + 26) % 26) + 65);
        }
        // Return other characters as-is
        return char;
    }).join('');
}

function getMyRole() {
    return state.myRole;
}

function canModerate() {
    return state.myRole === 'moderator';
}

function canVote() {
    return state.myRole === 'moderator' || state.myRole === 'participant';
}

function canComment() {
    return state.myRole === 'moderator' || state.myRole === 'participant';
}

function canNavigate() {
    return state.myRole === 'moderator';
}

// ============================================================================
// Session Persistence & Storage
// ============================================================================

const STORAGE_KEYS = {
    SESSIONS: 'retronium.sessions',
    PERSISTENCE_META: 'retronium.persistence'
};

let autosaveDebounceTimer = null;
let networkLog = [];

// Get persistence metadata
function getPersistenceMeta() {
    try {
        const meta = localStorage.getItem(STORAGE_KEYS.PERSISTENCE_META);
        return meta ? JSON.parse(meta) : {
            officialEnabled: false,
            consent: { accepted: false, timestamp: null },
            retentionDays: 30,
            useIndexedDB: false
        };
    } catch (e) {
        console.error('Error reading persistence metadata:', e);
        return {
            officialEnabled: false,
            consent: { accepted: false, timestamp: null },
            retentionDays: 30,
            useIndexedDB: false
        };
    }
}

// Save persistence metadata
function savePersistenceMeta(meta) {
    try {
        localStorage.setItem(STORAGE_KEYS.PERSISTENCE_META, JSON.stringify(meta));
    } catch (e) {
        console.error('Error saving persistence metadata:', e);
        handleStorageQuotaError();
    }
}

// List all saved sessions
function listLocalSessions() {
    try {
        const sessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
        return sessions ? JSON.parse(sessions) : [];
    } catch (e) {
        console.error('Error reading sessions:', e);
        return [];
    }
}

// Save a session snapshot
function saveSessionLocal(snapshot) {
    try {
        const sessions = listLocalSessions();
        sessions.push(snapshot);
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
        return true;
    } catch (e) {
        console.error('Error saving session:', e);
        handleStorageQuotaError();
        return false;
    }
}

// Delete a session by ID
function deleteLocalSession(sessionId) {
    try {
        const sessions = listLocalSessions();
        const filtered = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(filtered));
        return true;
    } catch (e) {
        console.error('Error deleting session:', e);
        return false;
    }
}

// Clear all sessions
function clearAllLocalSessions() {
    try {
        localStorage.removeItem(STORAGE_KEYS.SESSIONS);
        localStorage.removeItem(STORAGE_KEYS.PERSISTENCE_META);
        return true;
    } catch (e) {
        console.error('Error clearing sessions:', e);
        return false;
    }
}

// Build a session snapshot from current state
function buildSessionSnapshot(isOfficial = false) {
    return {
        id: generateId('snapshot'),
        createdAt: new Date().toISOString(),
        savedBy: state.username,
        isOfficial: isOfficial,
        hostPeerId: state.myPeerId,
        summary: {
            phase: state.currentPhase,
            cardsCount: state.cards.length,
            groupsCount: state.groups.length,
            actionsCount: state.actionItems.length,
            participantsCount: state.participants.length
        },
        state: {
            currentPhase: state.currentPhase,
            cards: state.cards,
            groups: state.groups,
            votes: state.votes,
            actionItems: state.actionItems,
            participants: state.participants
        }
    };
}

// Auto-save functionality
function markDirtyAndAutoSave() {
    if (autosaveDebounceTimer) {
        clearTimeout(autosaveDebounceTimer);
    }
    autosaveDebounceTimer = setTimeout(() => {
        autoSaveIfAllowed();
    }, 1500); // 1.5 second debounce
}

function autoSaveIfAllowed() {
    const meta = getPersistenceMeta();
    if (meta.officialEnabled && meta.consent.accepted && canModerate()) {
        const snapshot = buildSessionSnapshot(true);
        if (saveSessionLocal(snapshot)) {
            console.log('Auto-saved session at', new Date().toISOString());
        }
    }
}

// Filter sessions by retention days
function filterSessionsByRetention(sessions, retentionDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    return sessions.filter(s => new Date(s.createdAt) >= cutoffDate);
}

// Handle storage quota errors
function handleStorageQuotaError() {
    alert('Storage quota exceeded. Please export and delete old sessions, or enable IndexedDB migration.');
}

// Network logging for debug
function logNetworkEvent(event, data) {
    networkLog.push({
        timestamp: new Date().toISOString(),
        event: event,
        data: data
    });
    // Keep only last 100 events
    if (networkLog.length > 100) {
        networkLog.shift();
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    updatePhaseDisplay();
    
    // Check if URL contains session parameter for auto-join
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');
    if (sessionParam) {
        // Pre-fill the session ID input
        document.getElementById('peer-id-input').value = sessionParam;
        // Optionally auto-join (commented out for now to avoid auto-connecting without user intent)
        // setTimeout(() => joinSession(), 500);
    }
});

// Event Listeners
function initializeEventListeners() {
    // Connection controls
    document.getElementById('host-btn').addEventListener('click', hostSession);
    document.getElementById('join-btn').addEventListener('click', joinSession);
    document.getElementById('copy-btn').addEventListener('click', copySessionId);
    document.getElementById('copy-link-btn').addEventListener('click', copySessionLink);
    document.getElementById('show-qr-btn').addEventListener('click', toggleQRCode);
    
    // Settings menu
    document.getElementById('settings-btn').addEventListener('click', toggleSettingsMenu);
    document.getElementById('manage-roles-btn').addEventListener('click', openRoleModal);
    document.getElementById('export-session-btn').addEventListener('click', exportSession);
    document.getElementById('import-session-btn').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importSession);
    document.getElementById('close-role-modal').addEventListener('click', closeRoleModal);
    
    // Persistence controls
    document.getElementById('persist-toggle').addEventListener('change', handlePersistToggle);
    document.getElementById('open-sessions-btn').addEventListener('click', openSessionsModal);
    document.getElementById('debug-btn').addEventListener('click', openDebugModal);
    
    // Sessions modal
    document.getElementById('close-sessions-modal').addEventListener('click', closeSessionsModal);
    document.getElementById('save-snapshot-btn').addEventListener('click', saveManualSnapshot);
    document.getElementById('new-session-btn').addEventListener('click', handleNewSession);
    document.getElementById('export-all-btn').addEventListener('click', exportAllSessions);
    document.getElementById('clear-sessions-btn').addEventListener('click', clearAllSessions);
    document.getElementById('retention-days').addEventListener('change', handleRetentionChange);
    
    // Consent modal
    document.getElementById('consent-checkbox').addEventListener('change', (e) => {
        document.getElementById('accept-consent-btn').disabled = !e.target.checked;
    });
    document.getElementById('accept-consent-btn').addEventListener('click', acceptConsent);
    document.getElementById('decline-consent-btn').addEventListener('click', declineConsent);
    
    // Debug modal
    document.getElementById('close-debug-modal').addEventListener('click', closeDebugModal);
    document.getElementById('copy-network-btn').addEventListener('click', copyNetworkDump);
    
    // Close modals and dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        const settingsMenu = document.getElementById('settings-dropdown');
        const settingsBtn = document.getElementById('settings-btn');
        if (!settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
            settingsMenu.classList.add('hidden');
        }
    });
    
    document.getElementById('role-modal').addEventListener('click', (e) => {
        if (e.target.id === 'role-modal') {
            closeRoleModal();
        }
    });
    
    // Phase navigation
    document.querySelectorAll('.phase-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const phase = parseInt(e.target.dataset.phase);
            if (canNavigate()) {
                changePhase(phase);
            } else {
                alert('Only moderators can change phases');
            }
        });
    });
    
    // Phase 1: Cards
    document.getElementById('add-card-btn').addEventListener('click', addCard);
    document.getElementById('card-text').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            addCard();
        }
    });
    
    // Phase 5: Action Items
    document.getElementById('add-action-btn').addEventListener('click', addActionItem);
    document.getElementById('export-btn').addEventListener('click', exportSummary);
    
    // Modal click-outside to close
    document.getElementById('sessions-modal').addEventListener('click', (e) => {
        if (e.target.id === 'sessions-modal') {
            closeSessionsModal();
        }
    });
    
    document.getElementById('debug-modal').addEventListener('click', (e) => {
        if (e.target.id === 'debug-modal') {
            closeDebugModal();
        }
    });
    
    document.getElementById('persistence-consent-modal').addEventListener('click', (e) => {
        if (e.target.id === 'persistence-consent-modal') {
            declineConsent();
        }
    });
    
    // Initialize persistence toggle state
    const meta = getPersistenceMeta();
    document.getElementById('persist-toggle').checked = meta.officialEnabled && meta.consent.accepted;
    document.getElementById('retention-days').value = meta.retentionDays || 30;
}

// Connection Management
function hostSession() {
    // Prompt for username
    const username = prompt('Enter your name:', state.username);
    if (username && username.trim()) {
        state.username = username.trim();
    }
    
    try {
        // Configure PeerJS with explicit STUN servers for better mobile compatibility
        const peerConfig = {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ]
            }
        };
        
        state.peer = new Peer(peerConfig);
        state.isHost = true;
        state.myRole = 'moderator'; // Host is moderator by default
        
        state.peer.on('open', (id) => {
            state.myPeerId = id;
            document.getElementById('session-id').value = id;
            document.getElementById('host-info').classList.remove('hidden');
            document.getElementById('host-btn').disabled = true;
            updateConnectionStatus(true);
            
            addParticipant(state.username, state.myPeerId, 'moderator', true);
            updateModeratorControls();
            broadcastState();
        });
        
        state.peer.on('connection', (conn) => {
            setupConnection(conn);
        });
        
        state.peer.on('error', (err) => {
            console.error('Host peer error:', err);
            let errorMsg = 'Connection error: ' + err.type;
            if (err.type === 'network') {
                errorMsg = 'Network error. Please check your internet connection and try again.';
            } else if (err.type === 'server-error') {
                errorMsg = 'Server connection error. Please try again in a moment.';
            } else if (err.message) {
                errorMsg = 'Connection error: ' + err.message;
            }
            alert(errorMsg);
        });
    } catch (error) {
        console.error('Failed to create peer:', error);
        alert('Failed to start hosting. Please try again.');
    }
}

function joinSession() {
    const peerId = document.getElementById('peer-id-input').value.trim();
    if (!peerId) {
        alert('Please enter a session ID');
        return;
    }
    
    // Prompt for username
    const username = prompt('Enter your name:', state.username);
    if (username && username.trim()) {
        state.username = username.trim();
    }
    
    try {
        // Configure PeerJS with explicit STUN servers for better mobile compatibility
        const peerConfig = {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ]
            }
        };
        
        state.peer = new Peer(peerConfig);
        state.myRole = 'participant'; // Joiners are participants by default
        
        state.peer.on('open', (id) => {
            state.myPeerId = id;
            const conn = state.peer.connect(peerId);
            setupConnection(conn);
            
            document.getElementById('join-btn').disabled = true;
            updateConnectionStatus(true);
            updateModeratorControls();
        });
        
        state.peer.on('error', (err) => {
            console.error('Join peer error:', err);
            let errorMsg = 'Connection error: ' + err.type;
            if (err.type === 'network') {
                errorMsg = 'Network error. Please check your internet connection and try again.';
            } else if (err.type === 'peer-unavailable') {
                errorMsg = 'Unable to connect to host. The Session ID may be incorrect or the host may be offline.';
            } else if (err.type === 'server-error') {
                errorMsg = 'Server connection error. Please try again in a moment.';
            } else if (err.message) {
                errorMsg = 'Connection error: ' + err.message;
            }
            alert(errorMsg);
        });
    } catch (error) {
        console.error('Failed to join session:', error);
        alert('Failed to join session. Please check the session ID.');
    }
}

// Settings Menu Functions
function toggleSettingsMenu() {
    const dropdown = document.getElementById('settings-dropdown');
    dropdown.classList.toggle('hidden');
}

function updateModeratorControls() {
    const moderatorControls = document.getElementById('moderator-controls');
    if (canModerate()) {
        moderatorControls.style.display = 'block';
    } else {
        moderatorControls.style.display = 'none';
    }
}

function openRoleModal() {
    document.getElementById('role-modal').classList.remove('hidden');
    renderRoleManagement();
}

function closeRoleModal() {
    document.getElementById('role-modal').classList.add('hidden');
}

function renderRoleManagement() {
    const list = document.getElementById('role-management-list');
    list.innerHTML = '';
    
    state.participants.forEach(p => {
        const item = document.createElement('div');
        item.className = 'role-user-item';
        
        const info = document.createElement('div');
        info.className = 'role-user-info';
        
        const name = document.createElement('div');
        name.className = 'role-user-name';
        name.textContent = p.username + (p.username === state.username ? ' (You)' : '');
        info.appendChild(name);
        
        const badge = document.createElement('span');
        badge.className = `role-badge ${p.role}`;
        badge.textContent = p.role;
        info.appendChild(badge);
        
        item.appendChild(info);
        
        // Only show controls if current user is moderator and not managing themselves
        if (canModerate() && p.username !== state.username) {
            const controls = document.createElement('div');
            controls.className = 'role-controls';
            
            const select = document.createElement('select');
            ['moderator', 'participant', 'guest'].forEach(role => {
                const option = document.createElement('option');
                option.value = role;
                option.textContent = role.charAt(0).toUpperCase() + role.slice(1);
                option.selected = role === p.role;
                select.appendChild(option);
            });
            
            select.onchange = (e) => changeUserRole(p.peerId, e.target.value);
            controls.appendChild(select);
            
            item.appendChild(controls);
        }
        
        list.appendChild(item);
    });
}

function changeUserRole(peerId, newRole) {
    const participant = state.participants.find(p => p.peerId === peerId);
    if (participant) {
        participant.role = newRole;
        renderRoleManagement();
        updateParticipantsList();
        
        // Broadcast role change
        broadcastMessage({
            type: 'role_changed',
            peerId: peerId,
            role: newRole
        });
    }
}

// ============================================================================
// Persistence Modal Handlers
// ============================================================================

function handlePersistToggle(e) {
    const enabled = e.target.checked;
    
    if (!canModerate()) {
        e.target.checked = false;
        alert('Only moderators can enable persistence');
        return;
    }
    
    if (enabled) {
        // Show consent modal
        document.getElementById('persistence-consent-modal').classList.remove('hidden');
    } else {
        // Disable persistence
        const meta = getPersistenceMeta();
        meta.officialEnabled = false;
        savePersistenceMeta(meta);
    }
}

function acceptConsent() {
    const checkbox = document.getElementById('consent-checkbox');
    if (!checkbox.checked) {
        return;
    }
    
    const meta = getPersistenceMeta();
    meta.officialEnabled = true;
    meta.consent = {
        accepted: true,
        timestamp: new Date().toISOString()
    };
    savePersistenceMeta(meta);
    
    document.getElementById('persistence-consent-modal').classList.add('hidden');
    document.getElementById('persist-toggle').checked = true;
    
    alert('Auto-save enabled. Sessions will be saved automatically.');
}

function declineConsent() {
    document.getElementById('persistence-consent-modal').classList.add('hidden');
    document.getElementById('persist-toggle').checked = false;
    
    const meta = getPersistenceMeta();
    meta.officialEnabled = false;
    savePersistenceMeta(meta);
}

function openSessionsModal() {
    document.getElementById('sessions-modal').classList.remove('hidden');
    renderSessionsList();
}

function closeSessionsModal() {
    document.getElementById('sessions-modal').classList.add('hidden');
}

function renderSessionsList() {
    const list = document.getElementById('sessions-list');
    const meta = getPersistenceMeta();
    const retentionDays = meta.retentionDays || 30;
    
    let sessions = listLocalSessions();
    sessions = filterSessionsByRetention(sessions, retentionDays);
    
    // Sort by date, newest first
    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (sessions.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📂</div><p>No saved sessions</p></div>';
        return;
    }
    
    list.innerHTML = '';
    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item' + (session.isOfficial ? ' official' : '');
        
        const header = document.createElement('div');
        header.className = 'session-item-header';
        
        const title = document.createElement('div');
        title.className = 'session-item-title';
        title.textContent = `Session ${new Date(session.createdAt).toLocaleString()}`;
        if (session.isOfficial) {
            title.textContent += ' ⭐';
        }
        header.appendChild(title);
        
        const meta = document.createElement('div');
        meta.className = 'session-item-meta';
        meta.innerHTML = `
            Saved by: ${session.savedBy} | 
            Phase: ${session.summary.phase} | 
            Cards: ${session.summary.cardsCount} | 
            Groups: ${session.summary.groupsCount} | 
            Actions: ${session.summary.actionsCount}
        `;
        
        const actions = document.createElement('div');
        actions.className = 'session-item-actions';
        
        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'btn btn-small btn-primary';
        restoreBtn.textContent = '📥 Restore';
        restoreBtn.onclick = () => restoreSession(session);
        
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn btn-small btn-secondary';
        exportBtn.textContent = '📤 Export';
        exportBtn.onclick = () => exportSingleSession(session);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-small btn-danger';
        deleteBtn.textContent = '🗑️ Delete';
        deleteBtn.onclick = () => deleteSession(session.id);
        
        actions.appendChild(restoreBtn);
        actions.appendChild(exportBtn);
        actions.appendChild(deleteBtn);
        
        item.appendChild(header);
        item.appendChild(meta);
        item.appendChild(actions);
        
        list.appendChild(item);
    });
}

function saveManualSnapshot() {
    const snapshot = buildSessionSnapshot(false);
    if (saveSessionLocal(snapshot)) {
        alert('Session saved successfully!');
        renderSessionsList();
    } else {
        alert('Failed to save session. Storage may be full.');
    }
}

function restoreSession(session) {
    if (!confirm('This will replace the current session. Continue?')) {
        return;
    }
    
    // Restore state
    state.currentPhase = session.state.currentPhase;
    state.cards = session.state.cards || [];
    state.groups = session.state.groups || [];
    state.votes = session.state.votes || {};
    state.actionItems = session.state.actionItems || [];
    state.participants = session.state.participants || [];
    
    updateAllDisplays();
    
    // If moderator, offer to broadcast
    if (canModerate() && state.connections.length > 0) {
        if (confirm('Broadcast restored session to all connected peers?')) {
            broadcastState();
        }
    }
    
    closeSessionsModal();
    alert('Session restored successfully!');
}

function exportSingleSession(session) {
    const dataStr = JSON.stringify(session, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retronium-session-${new Date(session.createdAt).toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function exportAllSessions() {
    const sessions = listLocalSessions();
    if (sessions.length === 0) {
        alert('No sessions to export');
        return;
    }
    
    const dataStr = JSON.stringify(sessions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retronium-all-sessions-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    alert(`Exported ${sessions.length} session(s)`);
}

function clearAllSessions() {
    const sessions = listLocalSessions();
    if (sessions.length === 0) {
        alert('No sessions to clear');
        return;
    }
    
    if (!confirm(`This will delete all ${sessions.length} saved session(s). Export them first?`)) {
        return;
    }
    
    // Offer to export first
    const shouldExport = confirm('Export all sessions before clearing?');
    if (shouldExport) {
        exportAllSessions();
    }
    
    if (clearAllLocalSessions()) {
        alert('All sessions cleared');
        renderSessionsList();
    } else {
        alert('Failed to clear sessions');
    }
}

function deleteSession(sessionId) {
    if (!confirm('Delete this session?')) {
        return;
    }
    
    if (deleteLocalSession(sessionId)) {
        renderSessionsList();
    } else {
        alert('Failed to delete session');
    }
}

function handleRetentionChange(e) {
    const days = parseInt(e.target.value);
    if (days < 1 || days > 365) {
        alert('Retention must be between 1 and 365 days');
        e.target.value = 30;
        return;
    }
    
    const meta = getPersistenceMeta();
    meta.retentionDays = days;
    savePersistenceMeta(meta);
    
    // Re-render to apply new retention filter
    renderSessionsList();
}

function handleNewSession() {
    if (canModerate() && state.connections.length > 0) {
        if (confirm('Create new session and reset all peers?')) {
            // Broadcast new session message
            broadcastMessage({ type: 'new_session' });
            resetSession();
        }
    } else {
        if (confirm('Create new local session? This will reset your current session.')) {
            resetSession();
        }
    }
}

function resetSession() {
    state.cards = [];
    state.groups = [];
    state.votes = {};
    state.actionItems = [];
    state.currentPhase = 1;
    state.myVotesRemaining = 3;
    
    updateAllDisplays();
    alert('New session created');
}

// Debug Modal
function openDebugModal() {
    document.getElementById('debug-modal').classList.remove('hidden');
    updateDebugInfo();
}

function closeDebugModal() {
    document.getElementById('debug-modal').classList.add('hidden');
}

function updateDebugInfo() {
    const connectionInfo = {
        myPeerId: state.myPeerId,
        isHost: state.isHost,
        myRole: state.myRole,
        connectionsCount: state.connections.length,
        participantsCount: state.participants.length,
        peerOpen: state.peer ? state.peer.open : false,
        peerDisconnected: state.peer ? state.peer.disconnected : true
    };
    
    document.getElementById('debug-connection-info').textContent = JSON.stringify(connectionInfo, null, 2);
    document.getElementById('debug-network-dump').textContent = JSON.stringify(networkLog, null, 2);
}

function copyNetworkDump() {
    const dump = {
        connection: {
            myPeerId: state.myPeerId,
            isHost: state.isHost,
            myRole: state.myRole,
            connectionsCount: state.connections.length,
            participantsCount: state.participants.length
        },
        networkLog: networkLog,
        timestamp: new Date().toISOString()
    };
    
    const dumpStr = JSON.stringify(dump, null, 2);
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(dumpStr).then(() => {
            alert('Network dump copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy. Check console for dump.');
            console.log(dumpStr);
        });
    } else {
        alert('Clipboard not available. Check console for dump.');
        console.log(dumpStr);
    }
}

// Session Export/Import
function exportSession() {
    // Warn user about exporting decrypted data
    if (!confirm('This will export all session data including decrypted card text. Do you want to continue?')) {
        return;
    }
    
    const sessionData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        participants: state.participants,
        cards: state.cards.map(card => ({
            ...card,
            text: decryptText(card.text) // Export decrypted text for readability
        })),
        groups: state.groups,
        votes: state.votes,
        actionItems: state.actionItems,
        currentPhase: state.currentPhase
    };
    
    const json = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retronium-session-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Session exported successfully!');
}

function importSession(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const sessionData = JSON.parse(e.target.result);
            
            // Validate the data structure
            if (!sessionData.version || !sessionData.cards || !sessionData.groups) {
                alert('Invalid session file format');
                return;
            }
            
            // Restore state - encrypt card text on import since export has decrypted text
            state.cards = sessionData.cards.map(card => ({
                ...card,
                text: encryptText(card.text)
            }));
            state.groups = sessionData.groups;
            state.votes = sessionData.votes || {};
            state.actionItems = sessionData.actionItems || [];
            state.currentPhase = sessionData.currentPhase || 1;
            
            // Don't restore participants as that could conflict with current connections
            
            updateAllDisplays();
            
            // Broadcast the imported state if host
            if (state.isHost) {
                broadcastState();
            }
            
            alert('Session imported successfully!');
        } catch (error) {
            console.error('Failed to import session:', error);
            alert('Failed to import session. Please check the file format.');
        }
    };
    reader.readAsText(file);
    
    // Clear the file input
    event.target.value = '';
}

function setupConnection(conn) {
    state.connections.push(conn);
    
    conn.on('open', () => {
        logNetworkEvent('connection_open', { peer: conn.peer });
        
        // Send introduction
        conn.send({
            type: 'join',
            username: state.username,
            peerId: state.myPeerId,
            role: state.myRole
        });
        
        // If host, send current state
        if (state.isHost) {
            conn.send({
                type: 'state',
                state: {
                    cards: state.cards,
                    groups: state.groups,
                    votes: state.votes,
                    actionItems: state.actionItems,
                    participants: state.participants,
                    currentPhase: state.currentPhase
                }
            });
        }
    });
    
    conn.on('data', (data) => {
        logNetworkEvent('data_received', { type: data.type, from: conn.peer });
        handleMessage(data, conn);
    });
    
    conn.on('close', () => {
        logNetworkEvent('connection_close', { peer: conn.peer });
        const index = state.connections.indexOf(conn);
        if (index > -1) {
            state.connections.splice(index, 1);
        }
        updateConnectionStatus(state.connections.length > 0 || state.isHost);
    });
    
    conn.on('error', (err) => {
        logNetworkEvent('connection_error', { peer: conn.peer, error: err.toString() });
        console.error('Connection error:', err);
        // Handle connection errors gracefully
        const index = state.connections.indexOf(conn);
        if (index > -1) {
            state.connections.splice(index, 1);
        }
        updateConnectionStatus(state.connections.length > 0 || state.isHost);
    });
}

function handleMessage(data, conn) {
    switch (data.type) {
        case 'join':
            if (state.isHost) {
                addParticipant(data.username, data.peerId, data.role || 'participant', false);
                // Broadcast new participant to all existing peers
                broadcastMessage({
                    type: 'participant_added',
                    username: data.username,
                    peerId: data.peerId,
                    role: data.role || 'participant'
                });
                // Also broadcast updated full participant list to ensure sync
                broadcastMessage({
                    type: 'participants_sync',
                    participants: state.participants
                });
            }
            break;
        
        case 'participant_added':
            addParticipant(data.username, data.peerId, data.role || 'participant', false);
            break;
        
        case 'participants_sync':
            // Full participant list sync to ensure all peers have consistent view
            state.participants = data.participants || [];
            updateParticipantsList();
            break;
        
        case 'role_changed':
            const participant = state.participants.find(p => p.peerId === data.peerId);
            if (participant) {
                participant.role = data.role;
                
                // If it's my role that changed, update my local role
                if (data.peerId === state.myPeerId) {
                    state.myRole = data.role;
                    updateModeratorControls();
                }
                
                updateParticipantsList();
            }
            break;
        
        case 'state':
            // Receive full state from host
            state.cards = data.state.cards || [];
            state.groups = data.state.groups || [];
            state.votes = data.state.votes || {};
            state.actionItems = data.state.actionItems || [];
            state.participants = data.state.participants || [];
            state.currentPhase = data.state.currentPhase || 1;
            
            // Update my role based on participants list
            const me = state.participants.find(p => p.peerId === state.myPeerId);
            if (me) {
                state.myRole = me.role;
                updateModeratorControls();
            }
            
            updateAllDisplays();
            break;
        
        case 'card_added':
            state.cards.push(data.card);
            renderCards();
            break;
        
        case 'card_deleted':
            state.cards = state.cards.filter(c => c.id !== data.cardId);
            renderCards();
            break;
        
        case 'group_created':
            state.groups.push(data.group);
            renderGroupingPhase();
            break;
        
        case 'group_updated':
            const groupIndex = state.groups.findIndex(g => g.id === data.group.id);
            if (groupIndex > -1) {
                state.groups[groupIndex] = data.group;
            }
            renderGroupingPhase();
            break;
        
        case 'vote_cast':
            if (!state.votes[data.groupId]) {
                state.votes[data.groupId] = [];
            }
            state.votes[data.groupId].push(data.username);
            renderVotingPhase();
            break;
        
        case 'action_added':
            state.actionItems.push(data.action);
            renderActionItems();
            break;
        
        case 'action_updated':
            const actionIndex = state.actionItems.findIndex(a => a.id === data.action.id);
            if (actionIndex > -1) {
                state.actionItems[actionIndex] = data.action;
            }
            renderActionItems();
            break;
        
        case 'phase_changed':
            state.currentPhase = data.phase;
            updatePhaseDisplay();
            
            // Update content based on phase
            if (data.phase === 2) {
                renderGroupingPhase();
            } else if (data.phase === 3) {
                renderVotingPhase();
            } else if (data.phase === 4) {
                renderDiscussionPhase();
            }
            break;
        
        case 'new_session':
            if (confirm('The moderator has started a new session. Reset your local session?')) {
                resetSession();
            }
            break;
    }
}

function broadcastMessage(message) {
    state.connections.forEach(conn => {
        if (conn.open) {
            conn.send(message);
        }
    });
}

function broadcastState() {
    broadcastMessage({
        type: 'state',
        state: {
            cards: state.cards,
            groups: state.groups,
            votes: state.votes,
            actionItems: state.actionItems,
            participants: state.participants,
            currentPhase: state.currentPhase
        }
    });
}

function addParticipant(username, peerId, role, isMe) {
    if (!state.participants.find(p => p.peerId === peerId)) {
        state.participants.push({
            username,
            peerId,
            role: role || 'participant'
        });
        updateParticipantsList();
    }
}

function updateParticipantsList() {
    const list = document.getElementById('participants-list');
    list.innerHTML = state.participants.map(p => {
        const roleEmoji = p.role === 'moderator' ? '👑' : p.role === 'participant' ? '👤' : '👁️';
        return `<li>${roleEmoji} ${p.username}${p.username === state.username ? ' (You)' : ''}</li>`;
    }).join('');
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');
    
    if (connected) {
        indicator.classList.remove('status-disconnected');
        indicator.classList.add('status-connected');
        text.textContent = state.isHost ? 'Hosting' : 'Connected';
    } else {
        indicator.classList.remove('status-connected');
        indicator.classList.add('status-disconnected');
        text.textContent = 'Not Connected';
    }
}

function copySessionId() {
    const sessionId = document.getElementById('session-id');
    const btn = document.getElementById('copy-btn');
    
    // Use modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(sessionId.value)
            .then(() => {
                btn.textContent = 'Copied!';
                setTimeout(() => {
                    btn.textContent = 'Copy';
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                // Fallback to older method
                sessionId.select();
                try {
                    document.execCommand('copy');
                    btn.textContent = 'Copied!';
                    setTimeout(() => {
                        btn.textContent = 'Copy';
                    }, 2000);
                } catch (e) {
                    alert('Failed to copy. Please copy manually.');
                }
            });
    } else {
        // Fallback for older browsers
        sessionId.select();
        try {
            document.execCommand('copy');
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = 'Copy';
            }, 2000);
        } catch (e) {
            alert('Failed to copy. Please copy manually.');
        }
    }
}

function copySessionLink() {
    const sessionId = document.getElementById('session-id').value;
    const sessionUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    const btn = document.getElementById('copy-link-btn');
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(sessionUrl)
            .then(() => {
                btn.textContent = '✓ Copied!';
                setTimeout(() => {
                    btn.textContent = '📋 Copy Link';
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy link:', err);
                alert('Failed to copy. Please copy manually:\n' + sessionUrl);
            });
    } else {
        alert('Link:\n' + sessionUrl);
    }
}

let qrCodeInstance = null;

function toggleQRCode() {
    const qrContainer = document.getElementById('qr-code-container');
    const qrCodeDiv = document.getElementById('qr-code');
    const btn = document.getElementById('show-qr-btn');
    
    if (qrContainer.classList.contains('hidden')) {
        // Show QR code
        const sessionId = document.getElementById('session-id').value;
        const sessionUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
        
        // Clear previous QR code
        qrCodeDiv.innerHTML = '';
        
        // Generate QR code using API (fallback approach that works without external libraries)
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(sessionUrl)}`;
        const img = document.createElement('img');
        img.src = qrApiUrl;
        img.alt = 'Session QR Code';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        qrCodeDiv.appendChild(img);
        
        qrContainer.classList.remove('hidden');
        btn.textContent = '✕ Hide QR';
    } else {
        // Hide QR code
        qrContainer.classList.add('hidden');
        btn.textContent = '📱 Show QR Code';
        qrCodeDiv.innerHTML = '';
        qrCodeInstance = null;
    }
}

// Phase Management
function changePhase(phase) {
    state.currentPhase = phase;
    updatePhaseDisplay();
    
    // Broadcast phase change
    broadcastMessage({
        type: 'phase_changed',
        phase: phase
    });
    
    // Update content based on phase
    if (phase === 2) {
        renderGroupingPhase();
    } else if (phase === 3) {
        renderVotingPhase();
    } else if (phase === 4) {
        renderDiscussionPhase();
    }
    
    markDirtyAndAutoSave();
}

function updatePhaseDisplay() {
    // Update phase buttons
    document.querySelectorAll('.phase-btn').forEach(btn => {
        const btnPhase = parseInt(btn.dataset.phase);
        btn.classList.toggle('active', btnPhase === state.currentPhase);
    });
    
    // Update phase sections
    document.querySelectorAll('.phase').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`phase-${state.currentPhase}`).classList.add('active');
    
    // Update phase indicator
    const phaseNames = {
        1: 'Phase 1: Enter Cards',
        2: 'Phase 2: Group Cards',
        3: 'Phase 3: Vote',
        4: 'Phase 4: Discussion',
        5: 'Phase 5: Action Items'
    };
    document.getElementById('current-phase').textContent = phaseNames[state.currentPhase];
}

function updateAllDisplays() {
    renderCards();
    renderGroupingPhase();
    renderVotingPhase();
    renderDiscussionPhase();
    renderActionItems();
    updateParticipantsList();
    updatePhaseDisplay();
}

// Phase 1: Cards
function addCard() {
    if (!canComment()) {
        alert('You do not have permission to add cards. Only moderators and participants can add cards.');
        return;
    }
    
    const textInput = document.getElementById('card-text');
    const categorySelect = document.getElementById('card-category');
    const text = textInput.value.trim();
    
    if (!text) {
        alert('Please enter some text for the card');
        return;
    }
    
    const card = {
        id: generateId('card'),
        text: encryptText(text), // Store encrypted text
        category: categorySelect.value,
        author: state.username,
        timestamp: Date.now()
    };
    
    state.cards.push(card);
    renderCards();
    
    // Broadcast to peers
    broadcastMessage({
        type: 'card_added',
        card: card
    });
    
    // Clear input
    textInput.value = '';
    
    // Trigger autosave
    markDirtyAndAutoSave();
}

function deleteCard(cardId) {
    state.cards = state.cards.filter(c => c.id !== cardId);
    renderCards();
    
    broadcastMessage({
        type: 'card_deleted',
        cardId: cardId
    });
    
    // Trigger autosave
    markDirtyAndAutoSave();
}

function renderCards() {
    const goodCards = document.getElementById('good-cards');
    const badCards = document.getElementById('bad-cards');
    const improveCards = document.getElementById('improve-cards');
    
    goodCards.innerHTML = '';
    badCards.innerHTML = '';
    improveCards.innerHTML = '';
    
    state.cards.forEach(card => {
        const cardEl = createCardElement(card);
        
        if (card.category === 'good') {
            goodCards.appendChild(cardEl);
        } else if (card.category === 'bad') {
            badCards.appendChild(cardEl);
        } else if (card.category === 'improve') {
            improveCards.appendChild(cardEl);
        }
    });
}

function createCardElement(card, includeDelete = true) {
    const cardEl = document.createElement('div');
    cardEl.className = `card ${card.category}`;
    cardEl.dataset.cardId = card.id;
    cardEl.draggable = true;
    
    const content = document.createElement('div');
    content.className = 'card-content';
    
    // On Cards phase (phase 1), only show decrypted text to author
    // On other phases, show decrypted text to everyone
    const isAuthor = card.author === state.username;
    const isCardsPhase = state.currentPhase === 1;
    
    if (isCardsPhase && !isAuthor) {
        // Show blurred encrypted text to others in phase 1
        content.textContent = card.text; // Keep it encrypted
        cardEl.classList.add('card-blurred');
    } else {
        // Show decrypted text to author or on other phases
        content.textContent = decryptText(card.text);
    }
    
    cardEl.appendChild(content);
    
    if (includeDelete && card.author === state.username) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'card-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteCard(card.id);
        };
        cardEl.appendChild(deleteBtn);
    }
    
    // Drag events
    cardEl.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('cardId', card.id);
        e.target.style.opacity = '0.5';
    });
    
    cardEl.addEventListener('dragend', (e) => {
        e.target.style.opacity = '1';
    });
    
    return cardEl;
}

// Phase 2: Grouping
function renderGroupingPhase() {
    const groupingArea = document.getElementById('grouping-area');
    groupingArea.innerHTML = '';
    
    // Create groups
    state.groups.forEach(group => {
        const groupEl = createGroupElement(group);
        groupingArea.appendChild(groupEl);
    });
    
    // Add ungrouped cards
    const ungroupedCards = state.cards.filter(card => {
        return !state.groups.some(group => group.cardIds.includes(card.id));
    });
    
    if (ungroupedCards.length > 0) {
        const ungroupedDiv = document.createElement('div');
        ungroupedDiv.className = 'card-group';
        ungroupedDiv.dataset.groupId = 'ungrouped';
        
        const header = document.createElement('div');
        header.className = 'group-header';
        const title = document.createElement('h3');
        title.textContent = 'Ungrouped Cards';
        header.appendChild(title);
        ungroupedDiv.appendChild(header);
        
        const cardList = document.createElement('div');
        cardList.className = 'card-list';
        ungroupedCards.forEach(card => {
            cardList.appendChild(createCardElement(card, false));
        });
        ungroupedDiv.appendChild(cardList);
        
        setupDropZone(ungroupedDiv);
        groupingArea.appendChild(ungroupedDiv);
    }
    
    // Add "Create Group" button
    const createGroupBtn = document.createElement('button');
    createGroupBtn.className = 'btn btn-primary';
    createGroupBtn.textContent = '+ Create Group';
    createGroupBtn.onclick = createNewGroup;
    groupingArea.appendChild(createGroupBtn);
}

function createGroupElement(group) {
    const groupEl = document.createElement('div');
    groupEl.className = 'card-group';
    groupEl.dataset.groupId = group.id;
    
    const header = document.createElement('div');
    header.className = 'group-header';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'group-name';
    nameInput.value = group.name;
    nameInput.placeholder = 'Group Name...';
    nameInput.onchange = (e) => updateGroupName(group.id, e.target.value);
    header.appendChild(nameInput);
    
    groupEl.appendChild(header);
    
    const cardList = document.createElement('div');
    cardList.className = 'card-list';
    
    group.cardIds.forEach(cardId => {
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
            cardList.appendChild(createCardElement(card, false));
        }
    });
    
    groupEl.appendChild(cardList);
    setupDropZone(groupEl);
    
    return groupEl;
}

function setupDropZone(element) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.currentTarget.style.backgroundColor = '#e8f4f8';
    });
    
    element.addEventListener('dragleave', (e) => {
        e.currentTarget.style.backgroundColor = '';
    });
    
    element.addEventListener('drop', (e) => {
        e.preventDefault();
        e.currentTarget.style.backgroundColor = '';
        
        const cardId = e.dataTransfer.getData('cardId');
        const groupId = e.currentTarget.dataset.groupId;
        
        if (groupId && groupId !== 'ungrouped') {
            addCardToGroup(cardId, groupId);
        } else {
            removeCardFromGroups(cardId);
        }
    });
}

function createNewGroup() {
    const group = {
        id: generateId('group'),
        name: 'New Group',
        cardIds: []
    };
    
    state.groups.push(group);
    renderGroupingPhase();
    
    broadcastMessage({
        type: 'group_created',
        group: group
    });
    
    markDirtyAndAutoSave();
}

function addCardToGroup(cardId, groupId) {
    // Remove card from other groups
    state.groups.forEach(g => {
        g.cardIds = g.cardIds.filter(id => id !== cardId);
    });
    
    // Add to target group
    const group = state.groups.find(g => g.id === groupId);
    if (group && !group.cardIds.includes(cardId)) {
        group.cardIds.push(cardId);
        renderGroupingPhase();
        
        broadcastMessage({
            type: 'group_updated',
            group: group
        });
        
        markDirtyAndAutoSave();
    }
}

function removeCardFromGroups(cardId) {
    state.groups.forEach(g => {
        g.cardIds = g.cardIds.filter(id => id !== cardId);
    });
    renderGroupingPhase();
    markDirtyAndAutoSave();
}

function updateGroupName(groupId, newName) {
    const group = state.groups.find(g => g.id === groupId);
    if (group) {
        group.name = newName;
        
        broadcastMessage({
            type: 'group_updated',
            group: group
        });
        
        markDirtyAndAutoSave();
    }
}

// Phase 3: Voting
function renderVotingPhase() {
    const votingArea = document.getElementById('voting-area');
    votingArea.innerHTML = '';
    
    // Show votes remaining with visual indication when exhausted
    const votesRemainingDiv = document.createElement('div');
    votesRemainingDiv.className = 'votes-remaining';
    if (state.myVotesRemaining === 0) {
        votesRemainingDiv.classList.add('votes-exhausted');
        votesRemainingDiv.textContent = '🚫 All votes used!';
    } else {
        votesRemainingDiv.textContent = `Votes Remaining: ${state.myVotesRemaining}`;
    }
    votingArea.appendChild(votesRemainingDiv);
    
    // Show groups for voting (only groups with cards)
    const votableGroups = state.groups.filter(g => g.cardIds.length > 0);
    
    votableGroups.forEach(group => {
        const voteGroupEl = createVoteGroupElement(group);
        votingArea.appendChild(voteGroupEl);
    });
}

function createVoteGroupElement(group) {
    const groupEl = document.createElement('div');
    groupEl.className = 'vote-group';
    
    const myVotes = (state.votes[group.id] || []).filter(v => v === state.username).length;
    if (myVotes > 0) {
        groupEl.classList.add('voted');
    }
    
    const header = document.createElement('div');
    header.className = 'vote-header';
    
    const name = document.createElement('h3');
    name.textContent = group.name;
    header.appendChild(name);
    
    const voteCount = document.createElement('div');
    voteCount.className = 'vote-count';
    const totalVotes = (state.votes[group.id] || []).length;
    voteCount.textContent = `${totalVotes} votes`;
    header.appendChild(voteCount);
    
    groupEl.appendChild(header);
    
    const cardList = document.createElement('div');
    cardList.className = 'discussion-cards';
    group.cardIds.forEach(cardId => {
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
            const cardEl = createCardElement(card, false);
            cardEl.draggable = false;
            cardList.appendChild(cardEl);
        }
    });
    groupEl.appendChild(cardList);
    
    groupEl.onclick = () => voteForGroup(group.id);
    
    return groupEl;
}

function voteForGroup(groupId) {
    if (!canVote()) {
        alert('You do not have permission to vote. Only moderators and participants can vote.');
        return;
    }
    
    if (state.myVotesRemaining <= 0) {
        alert('You have no votes remaining!');
        return;
    }
    
    if (!state.votes[groupId]) {
        state.votes[groupId] = [];
    }
    
    state.votes[groupId].push(state.username);
    state.myVotesRemaining--;
    
    renderVotingPhase();
    
    broadcastMessage({
        type: 'vote_cast',
        groupId: groupId,
        username: state.username
    });
    
    markDirtyAndAutoSave();
}

// Phase 4: Discussion
function renderDiscussionPhase() {
    const discussionArea = document.getElementById('discussion-area');
    discussionArea.innerHTML = '';
    
    // Sort groups by vote count
    const sortedGroups = [...state.groups]
        .filter(g => g.cardIds.length > 0)
        .sort((a, b) => {
            const votesA = (state.votes[a.id] || []).length;
            const votesB = (state.votes[b.id] || []).length;
            return votesB - votesA;
        });
    
    sortedGroups.forEach((group, index) => {
        const discussionGroupEl = createDiscussionGroupElement(group, index + 1);
        discussionArea.appendChild(discussionGroupEl);
    });
}

function createDiscussionGroupElement(group, rank) {
    const groupEl = document.createElement('div');
    groupEl.className = 'discussion-group';
    
    const header = document.createElement('div');
    header.className = 'discussion-header';
    
    const rankDiv = document.createElement('div');
    rankDiv.className = 'discussion-rank';
    rankDiv.textContent = rank;
    header.appendChild(rankDiv);
    
    const info = document.createElement('div');
    info.style.flex = '1';
    
    const name = document.createElement('h3');
    name.textContent = group.name;
    info.appendChild(name);
    
    const voteCount = document.createElement('p');
    const totalVotes = (state.votes[group.id] || []).length;
    voteCount.textContent = `${totalVotes} votes`;
    voteCount.style.color = 'var(--text-light)';
    info.appendChild(voteCount);
    
    header.appendChild(info);
    groupEl.appendChild(header);
    
    const cardList = document.createElement('div');
    cardList.className = 'discussion-cards';
    group.cardIds.forEach(cardId => {
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
            const cardEl = createCardElement(card, false);
            cardEl.draggable = false;
            cardList.appendChild(cardEl);
        }
    });
    groupEl.appendChild(cardList);
    
    return groupEl;
}

// Phase 5: Action Items
function addActionItem() {
    const textInput = document.getElementById('action-text');
    const ownerInput = document.getElementById('action-owner');
    
    const text = textInput.value.trim();
    const owner = ownerInput.value.trim();
    
    if (!text) {
        alert('Please enter an action item');
        return;
    }
    
    const action = {
        id: generateId('action'),
        text: text,
        owner: owner || 'Unassigned',
        completed: false,
        timestamp: Date.now()
    };
    
    state.actionItems.push(action);
    renderActionItems();
    
    broadcastMessage({
        type: 'action_added',
        action: action
    });
    
    textInput.value = '';
    ownerInput.value = '';
    
    markDirtyAndAutoSave();
}

function toggleActionItem(actionId) {
    const action = state.actionItems.find(a => a.id === actionId);
    if (action) {
        action.completed = !action.completed;
        renderActionItems();
        
        broadcastMessage({
            type: 'action_updated',
            action: action
        });
        
        markDirtyAndAutoSave();
    }
}

function renderActionItems() {
    const list = document.getElementById('action-items-list');
    list.innerHTML = '';
    
    if (state.actionItems.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-light);">No action items yet</p>';
        return;
    }
    
    state.actionItems.forEach(action => {
        const actionEl = document.createElement('div');
        actionEl.className = `action-item ${action.completed ? 'completed' : ''}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'action-checkbox';
        checkbox.checked = action.completed;
        checkbox.onchange = () => toggleActionItem(action.id);
        actionEl.appendChild(checkbox);
        
        const content = document.createElement('div');
        content.className = 'action-content';
        
        const text = document.createElement('div');
        text.className = 'action-text';
        text.textContent = action.text;
        content.appendChild(text);
        
        const owner = document.createElement('div');
        owner.className = 'action-owner';
        owner.textContent = `Owner: ${action.owner}`;
        content.appendChild(owner);
        
        actionEl.appendChild(content);
        list.appendChild(actionEl);
    });
}

function exportSummary() {
    let summary = '# Retro Summary\n\n';
    summary += `Date: ${new Date().toLocaleDateString()}\n\n`;
    
    summary += '## Participants\n';
    state.participants.forEach(p => {
        const roleLabel = p.role === 'moderator' ? '👑' : p.role === 'participant' ? '👤' : '👁️';
        summary += `- ${roleLabel} ${p.username} (${p.role})\n`;
    });
    summary += '\n';
    
    summary += '## Discussion Topics (by votes)\n';
    const sortedGroups = [...state.groups]
        .filter(g => g.cardIds.length > 0)
        .sort((a, b) => {
            const votesA = (state.votes[a.id] || []).length;
            const votesB = (state.votes[b.id] || []).length;
            return votesB - votesA;
        });
    
    sortedGroups.forEach((group, index) => {
        const votes = (state.votes[group.id] || []).length;
        summary += `\n### ${index + 1}. ${group.name} (${votes} votes)\n`;
        group.cardIds.forEach(cardId => {
            const card = state.cards.find(c => c.id === cardId);
            if (card) {
                // Export decrypted text
                summary += `- ${decryptText(card.text)}\n`;
            }
        });
    });
    
    summary += '\n## Action Items\n';
    if (state.actionItems.length === 0) {
        summary += 'No action items recorded.\n';
    } else {
        state.actionItems.forEach((action, index) => {
            const status = action.completed ? '[x]' : '[ ]';
            summary += `${index + 1}. ${status} ${action.text} (Owner: ${action.owner})\n`;
        });
    }
    
    // Download as file
    const blob = new Blob([summary], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retro-summary-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
