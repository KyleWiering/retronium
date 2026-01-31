// Application State
const state = {
    currentPhase: 1,
    myPeerId: null,
    isHost: false,
    peer: null,
    connections: [],
    participants: [],
    cards: [],
    groups: [],
    votes: {},
    myVotesRemaining: 3,
    actionItems: [],
    username: `User${Math.floor(Math.random() * 10000)}`
};

// Utility Functions
function generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    updatePhaseDisplay();
});

// Event Listeners
function initializeEventListeners() {
    // Connection controls
    document.getElementById('host-btn').addEventListener('click', hostSession);
    document.getElementById('join-btn').addEventListener('click', joinSession);
    document.getElementById('copy-btn').addEventListener('click', copySessionId);
    
    // Phase navigation
    document.querySelectorAll('.phase-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const phase = parseInt(e.target.dataset.phase);
            changePhase(phase);
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
}

// Connection Management
function hostSession() {
    // Prompt for username
    const username = prompt('Enter your name:', state.username);
    if (username && username.trim()) {
        state.username = username.trim();
    }
    
    try {
        state.peer = new Peer();
        state.isHost = true;
        
        state.peer.on('open', (id) => {
            state.myPeerId = id;
            document.getElementById('session-id').value = id;
            document.getElementById('host-info').classList.remove('hidden');
            document.getElementById('host-btn').disabled = true;
            updateConnectionStatus(true);
            
            addParticipant(state.username, true);
            broadcastState();
        });
        
        state.peer.on('connection', (conn) => {
            setupConnection(conn);
        });
        
        state.peer.on('error', (err) => {
            console.error('Peer error:', err);
            alert('Connection error: ' + err.message);
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
        state.peer = new Peer();
        
        state.peer.on('open', (id) => {
            state.myPeerId = id;
            const conn = state.peer.connect(peerId);
            setupConnection(conn);
            
            document.getElementById('join-btn').disabled = true;
            updateConnectionStatus(true);
        });
        
        state.peer.on('error', (err) => {
            console.error('Peer error:', err);
            alert('Connection error: ' + err.message);
        });
    } catch (error) {
        console.error('Failed to join session:', error);
        alert('Failed to join session. Please check the session ID.');
    }
}

function setupConnection(conn) {
    state.connections.push(conn);
    
    conn.on('open', () => {
        // Send introduction
        conn.send({
            type: 'join',
            username: state.username,
            peerId: state.myPeerId
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
        handleMessage(data, conn);
    });
    
    conn.on('close', () => {
        const index = state.connections.indexOf(conn);
        if (index > -1) {
            state.connections.splice(index, 1);
        }
        updateConnectionStatus(state.connections.length > 0);
    });
}

function handleMessage(data, conn) {
    switch (data.type) {
        case 'join':
            if (state.isHost) {
                addParticipant(data.username, false);
                // Broadcast new participant to all
                broadcastMessage({
                    type: 'participant_added',
                    username: data.username
                });
            }
            break;
        
        case 'participant_added':
            addParticipant(data.username, false);
            break;
        
        case 'state':
            // Receive full state from host
            state.cards = data.state.cards || [];
            state.groups = data.state.groups || [];
            state.votes = data.state.votes || {};
            state.actionItems = data.state.actionItems || [];
            state.participants = data.state.participants || [];
            state.currentPhase = data.state.currentPhase || 1;
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

function addParticipant(username, isMe) {
    if (!state.participants.includes(username)) {
        state.participants.push(username);
        updateParticipantsList();
    }
}

function updateParticipantsList() {
    const list = document.getElementById('participants-list');
    list.innerHTML = state.participants.map(p => 
        `<li>${p}${p === state.username ? ' (You)' : ''}</li>`
    ).join('');
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
    const textInput = document.getElementById('card-text');
    const categorySelect = document.getElementById('card-category');
    const text = textInput.value.trim();
    
    if (!text) {
        alert('Please enter some text for the card');
        return;
    }
    
    const card = {
        id: generateId('card'),
        text: text,
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
}

function deleteCard(cardId) {
    state.cards = state.cards.filter(c => c.id !== cardId);
    renderCards();
    
    broadcastMessage({
        type: 'card_deleted',
        cardId: cardId
    });
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
    content.textContent = card.text;
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
    }
}

function removeCardFromGroups(cardId) {
    state.groups.forEach(g => {
        g.cardIds = g.cardIds.filter(id => id !== cardId);
    });
    renderGroupingPhase();
}

function updateGroupName(groupId, newName) {
    const group = state.groups.find(g => g.id === groupId);
    if (group) {
        group.name = newName;
        
        broadcastMessage({
            type: 'group_updated',
            group: group
        });
    }
}

// Phase 3: Voting
function renderVotingPhase() {
    const votingArea = document.getElementById('voting-area');
    votingArea.innerHTML = '';
    
    // Show votes remaining
    const votesRemainingDiv = document.createElement('div');
    votesRemainingDiv.className = 'votes-remaining';
    votesRemainingDiv.textContent = `Votes Remaining: ${state.myVotesRemaining}`;
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
        summary += `- ${p}\n`;
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
                summary += `- ${card.text}\n`;
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
