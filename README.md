# Retronium

A client-side only web application for conducting scrum retrospectives with peer-to-peer connections.

## Features

- **Peer-to-Peer Connections**: No server required - one browser hosts the session and others join directly
- **5-Phase Retro Process**:
  1. **Enter Cards**: Team members add cards categorized as Good 👍, Bad 👎, or Improve 💡
  2. **Group Cards**: Drag and drop similar cards together to create themed groups
  3. **Vote**: Each participant gets 3 votes to prioritize groups
  4. **Discussion**: Groups are sorted by votes for structured discussion
  5. **Action Items**: Track outcomes with assigned owners
- **Export Summary**: Download a markdown summary of the entire retrospective
- **Real-time Sync**: All changes are synchronized across connected participants

## Getting Started

### Running Locally

1. Clone the repository:
```bash
git clone https://github.com/KyleWiering/retronium.git
cd retronium
```

2. Start a local web server:
```bash
# Using Python 3
python3 -m http.server 8080

# Or using Node.js
npx http-server -p 8080
```

3. Open your browser and navigate to `http://localhost:8080`

### Hosting a Session

1. Click the **"Host Session"** button in the left sidebar
2. Copy the Session ID that appears
3. Share the Session ID with other participants

### Joining a Session

1. Get the Session ID from the host
2. Enter it in the **"Enter Session ID"** field
3. Click the **"Join Session"** button

## Usage Guide

### Phase 1: Enter Cards

- Type your thoughts in the text area
- Select a category: Good 👍, Bad 👎, or Improve 💡
- Click **"Add Card"** or press Ctrl+Enter
- Cards can be deleted by clicking the × button (only your own cards)

### Phase 2: Group Cards

- Drag cards to group similar items together
- Click **"+ Create Group"** to add a new group
- Click on a group name to edit it
- Ungrouped cards remain in the "Ungrouped Cards" area

### Phase 3: Vote

- Each participant has 3 votes
- Click on a group to cast a vote
- Groups with your votes are highlighted
- Vote counts are visible on each group

### Phase 4: Discussion

- Groups are automatically sorted by vote count
- Discuss each group starting from the highest priority
- All cards in each group are visible for reference

### Phase 5: Action Items

- Add action items with descriptions and owners
- Check off completed items
- Click **"Export Summary"** to download a markdown report

## Technical Details

### Technology Stack

- **HTML5** - Structure
- **CSS3** - Styling with CSS variables for theming
- **Vanilla JavaScript** - Application logic
- **PeerJS** - WebRTC peer-to-peer connections

### Browser Support

Modern browsers with WebRTC support:
- Chrome/Edge 80+
- Firefox 75+
- Safari 13+

### Architecture

- **Client-side only**: No backend server required
- **Peer-to-peer**: Direct browser-to-browser communication using WebRTC
- **State management**: Centralized state with broadcast synchronization
- **Responsive design**: Works on desktop and mobile devices

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.
