# Cat of the Day - Twitch Channel Points Widget

A Twitch streaming widget that allows viewers to redeem "Cat of the Day" using channel points. Features 7TV emote integration, 24-hour winner persistence, custom audio, and stream-optimized visuals.

## Features

- 🎯 **Channel Points Integration** - Works with Twitch EventSub for real-time redemptions
- 🐱 **7TV Emote Support** - Fetches emotes from your channel with high-resolution display
- ⏰ **24-Hour Winner Memory** - Remembers the winning cat for 24 hours (configurable)
- 🎵 **Custom Audio** - Rolling sounds and win sounds with volume control
- 🎨 **Stream-Friendly UI** - Professional appearance with rarity-based colors
- 🏆 **Special Effects** - Gold styling for legendary wins
- 🔧 **Debug Controls** - Testing functions and logging for development
- ⏸️ **Pause Functionality** - Pause animations during testing

## Setup Instructions

### 1. Prerequisites

- Twitch account with channel points enabled
- 7TV account and emotes configured for your channel
- OBS Studio or similar streaming software
- Web browser for configuration

### 2. Configuration

1. **Copy `config.example.json` to `config.json`**
2. **Update the following settings:**

```json
{
  "channel": {
    "name": "YOUR_TWITCH_USERNAME"
  },
  "emotes": {
    "channelID": "YOUR_7TV_CHANNEL_ID",
    "targetEmotes": ["emote1", "emote2", "emote3"]
  },
  "twitch": {
    "channelPoints": {
      "specificRewardId": "YOUR_CHANNEL_POINT_REWARD_ID",
      "actualRewardTitle": "CAT OF THE DAY"
    },
    "oauth": {
      "clientId": "YOUR_TWITCH_CLIENT_ID",
      "accessToken": "YOUR_TWITCH_ACCESS_TOKEN"
    }
  }
}
```

### 3. Getting Required IDs

#### Twitch Client ID & Access Token

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console)
2. Create a new application
3. Set redirect URI to `http://localhost` or your domain
4. Note your Client ID
5. Generate an access token with `channel:read:redemptions` scope

#### 7TV Channel ID

1. Go to your 7TV channel page
2. Your channel ID is in the URL: `https://7tv.app/users/YOUR_CHANNEL_ID`

#### Channel Points Reward ID

1. Create a channel point reward called "CAT OF THE DAY"
2. Use browser dev tools to inspect network requests when creating the reward
3. Find the reward ID in the API response

### 4. OBS Studio Setup

#### Method 1: Browser Source (Recommended)

1. **Add Browser Source:**
   - Right-click in Sources → Add → Browser Source
   - Name: "Cat of the Day"

2. **Configure Browser Source:**
   - **URL:** `file:///C:/path/to/your/CATOFTHEDAY/index.html`
   - **Width:** 1920
   - **Height:** 1080
   - **Custom CSS:** (optional for positioning)

   ```css
   body { 
     margin: 0; 
     background: transparent; 
   }
   ```

3. **Position the Source:**
   - Scale and position as needed for your overlay
   - Recommended: Center or top-center of screen

#### Method 2: Local Server

1. **Install a local web server** (e.g., `http-server` via npm)
2. **Run server in the CATOFTHEDAY folder:**

   ```bash
   npx http-server -p 8080 --cors
   ```

3. **Use URL:** `http://localhost:8080`

### 5. Audio Setup

#### Custom Audio Files

- Place `gamba.mp3` in the project folder for rolling sound
- Place `ding.mp3` in the project folder for win sound
- Update `config.json` audio settings as needed

#### Volume Control

```json
"audio": {
  "rollingSound": "gamba.mp3",
  "winSound": {
    "useCustom": true,
    "customFile": "ding.mp3", 
    "volume": 0.5
  }
}
```

## Usage

### For Viewers

1. Redeem "CAT OF THE DAY" channel point reward
2. Watch the emote rolling animation
3. See the winning cat displayed for 24 hours

### For Streamers

- Widget automatically shows waiting message when no redemptions
- Winner persists for 24 hours (configurable)
- Manual testing available via browser console

### Testing Functions

Open browser console (F12) and use:

```javascript
testRoll()           // Test a redemption
pauseAnimation()     // Pause during animation
resumeAnimation()    // Resume animation
togglePause()        // Toggle pause state
```

## Configuration Options

### Rarity System

- **Weights:** Control probability of each rarity
- **Colors:** Customize border and text colors
- **Special Effects:** Gold styling for legendary wins

### Persistence

```json
"persistence": {
  "enableWinnerMemory": true,
  "winnerDurationHours": 24,
  "allowRollCommand": true
}
```

### Debug Settings

```json
"debug": {
  "enableLogging": false,  // Set true for development
  "showFallbackEmotes": false
}
```

## Troubleshooting

### Common Issues

1. **Widget shows "WAITING FOR REDEMPTION"**
   - Check channel point reward ID is correct
   - Verify OAuth token has correct scopes
   - Ensure EventSub connection is established

2. **Emotes not loading**
   - Verify 7TV channel ID
   - Check emote names in targetEmotes array
   - Enable debug logging to see network requests

3. **Audio not playing**
   - Check file paths in config
   - Verify audio files exist
   - Check browser audio permissions

4. **OBS not showing widget**
   - Verify file path is correct
   - Check browser source dimensions
   - Try refreshing the browser source

### Debug Mode

Set `"enableLogging": true` in config.json to see detailed console logs.

## Winner History Tracking

The widget automatically tracks all winners in browser localStorage with the following information:
- Emote name and rarity
- Timestamp of win
- Image URL

### Available Console Commands

Open your browser's developer console (F12) to use these commands:

```javascript
// Export winner history to JSON file
exportWinnerHistory()

// View statistics in console
getWinnerStats()

// Clear all history (with confirmation)
clearWinnerHistory()
```

### History File

A template `winners-history.json` file is included in the project. The actual history is stored in browser localStorage and can be exported using the `exportWinnerHistory()` command.

The exported JSON contains:
- Export timestamp
- Statistics (total rolls, rarity distribution, emote frequency)
- Complete history of all winners

## File Structure

```
CATOFTHEDAY/
├── index.html          # Main HTML file
├── script.js           # Main application logic
├── styles.css          # Styling and animations
├── config.json         # Your configuration (create from example)
├── config.example.json # Example configuration
├── winners-history.json # Winner history template
├── gamba.mp3          # Rolling sound (optional)
├── ding.mp3           # Win sound (optional)
├── .gitignore         # Git ignore file
└── README.md          # This file
```

## Support

For issues or questions:

1. Check console logs with debug mode enabled
2. Verify all configuration values
3. Test with browser developer tools
4. Check network connectivity to Twitch/7TV APIs

## License

This project is provided as-is for streaming purposes.

##

This Readme Is Auto Generate
