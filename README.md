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

### Live Demo

The application is automatically deployed to GitHub Pages on every merge to main:
🌐 **[https://kylewiering.github.io/retronium/](https://kylewiering.github.io/retronium/)**

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

## Deployment & Releases

### Automated Deployment

The application is automatically deployed to GitHub Pages when changes are merged to the `main` branch. The deployment workflow:

1. **Versioning**: Automatically increments the patch version (e.g., 0.1.0 → 0.1.1)
2. **Release Creation**: Creates a GitHub release with the new version tag
3. **Release Notes**: Automatically includes PR information and changelog
4. **GitHub Pages**: Deploys the updated application to GitHub Pages

### Versioning

Versions follow semantic versioning (MAJOR.MINOR.PATCH):
- The current version is stored in `version.txt`
- The version is displayed in the application header
- Each merge to main automatically increments the patch version

### Releases

Every merge to main triggers:
- A new version tag (e.g., `v0.1.1`)
- A GitHub release with the version number
- Release notes containing the PR title, description, and author
- A link to the full changelog between versions

## New Features

### QR Code & Easy Mobile Joining

- **QR Code Generation**: When hosting a session, click "Show QR Code" to display a scannable QR code for mobile devices
- **Copy Link**: Share the full session URL with one click using the "Copy Link" button
- **Auto-Join**: When someone clicks a shared link, the session ID is automatically pre-filled

### Session Persistence (GDPR Compliant)

- **Auto-Save**: Moderators can enable automatic session saving with explicit consent
- **Session History**: View, restore, export, or delete previously saved sessions
- **Retention Control**: Set how long sessions are kept (default: 30 days)
- **Privacy First**: All data is stored locally in your browser, never sent to external servers

### Debug Tools

- **Network Logging**: Track connection events and troubleshoot WebRTC issues
- **Debug Modal**: View connection state and export network dumps for diagnostics

### Quick Local Testing

To test WebRTC locally, you'll need two browser instances:

1. Start a local server:
```bash
python3 -m http.server 8080
```

2. Open two browser windows/tabs:
   - Window 1: `http://localhost:8080/` - Click "Host Session"
   - Window 2: `http://localhost:8080/` - Copy the session ID from Window 1 and join

**Note**: For testing across different devices on the same network, replace `localhost` with your machine's local IP address (e.g., `http://192.168.1.100:8080/`).

### Docker-Based E2E Testing

For automated testing with isolated browser instances and self-hosted P2P infrastructure:

#### Prerequisites
- Docker and Docker Compose installed

#### Running Tests

**Windows:**
```cmd
run-tests.bat
```

**Linux/macOS:**
```bash
chmod +x run-tests.sh
./run-tests.sh
```

#### What the Tests Do

1. **Spin up self-hosted infrastructure**:
   - PeerJS signaling server (no external cloud dependency)
   - Coturn STUN/TURN server (no Google dependency)
   - Nginx web server serving the application

2. **Launch two isolated browser instances**:
   - Browser 1 (Host): Creates a session
   - Browser 2 (Client): Joins the session

3. **Execute P2P tests**:
   - Connection establishment
   - Card exchange between peers
   - State synchronization

4. **Output JSON results** for AI parsing:
   - `test-results/host-result.json`
   - `test-results/client-result.json`

#### Test Result Format

```json
{
  "role": "host",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "success": true,
  "steps": [
    { "step": "Navigate to app", "success": true },
    { "step": "Session created", "success": true, "sessionId": "..." }
  ],
  "errors": [],
  "cardsExchanged": true,
  "sessionId": "abc123",
  "connectionInfo": {
    "statusText": "Connected",
    "participants": ["TestHost", "TestClient"]
  }
}
```

### Self-Hosted P2P Infrastructure

The application supports fully self-hosted P2P infrastructure without any external dependencies:

#### Configuration

The app auto-detects the environment:
- **Local/Docker**: Uses self-hosted PeerJS + coturn
- **Production**: Falls back to PeerJS cloud + Google STUN

Override with URL parameter:
- `?useLocalServers=true` - Force local servers
- `?useLocalServers=false` - Force cloud servers

#### Running Self-Hosted Servers

Start all infrastructure services:
```bash
docker compose up peerjs-server coturn webserver
```

Access the app at `http://localhost:8080`

#### Coturn TURN Server Credentials

For self-hosted deployments:
- **Username**: `retronium`
- **Password**: `retronium123`

**⚠️ Security Note**: Change these credentials for production use. Edit `server/turnserver.conf`.

**TURN/STUN Notes**: The app uses Google's public STUN servers for NAT traversal. For production use with restrictive firewalls, consider setting up your own TURN server.

## CI/CD Testing

### Automated P2P Tests on Pull Requests

Every pull request automatically runs comprehensive P2P tests to verify networking functionality:

#### Test Coverage

1. **Self-Hosted Infrastructure Test**
   - Uses local PeerJS signaling server (port 9000)
   - Uses local Coturn STUN/TURN (ports 3478/5349)
   - Verifies P2P connection without external dependencies

2. **Cloud Infrastructure Test**
   - Uses PeerJS Cloud signaling
   - Uses Google STUN servers
   - Verifies P2P connection via public internet

#### Test Workflow

The GitHub Actions workflow (`.github/workflows/test-p2p.yml`):
1. Builds Docker containers with isolated browser instances
2. Runs both test configurations in parallel
3. Captures test results as JSON
4. Generates visual HTML reports
5. Takes screenshots of test results
6. Posts results back to the PR with:
   - ✅/❌ Status badges
   - Test metrics (steps completed, connection time)
   - Embedded screenshots
   - Full JSON results in collapsible details

#### Viewing Test Results

Test results appear automatically as a comment on your PR:

```
🧪 P2P Test Results

Self-Hosted Infrastructure
✅ PASSED
- Host Steps Completed: 8
- Client Steps Completed: 9

Cloud Infrastructure  
✅ PASSED
- Host Steps Completed: 8
- Client Steps Completed: 9

📸 [Screenshots and detailed results...]
```

#### Test Artifacts

All test runs save artifacts for 30 days:
- `test-results-local/` - Self-hosted test JSON results
- `test-results-cloud/` - Cloud test JSON results
- `test-screenshot-local.png` - Self-hosted results visualization
- `test-screenshot-cloud.png` - Cloud results visualization
- `test-output-*.log` - Full test execution logs

#### Running Tests Locally

Run the same tests that CI runs:

```bash
# Self-hosted infrastructure test
./run-tests.sh

# Cloud infrastructure test  
docker compose -f docker-compose.cloud.yml up --abort-on-container-exit
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

All PRs will automatically run P2P tests to verify networking functionality. Ensure tests pass before requesting review.

## License

This project is open source and available under the MIT License.
