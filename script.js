// ===== CONFIG MANAGEMENT =====
class ConfigManager {
    constructor() {
        this.config = null;
    }

    async loadConfig() {
        try {
            const response = await fetch('./config.json');
            if (!response.ok) throw new Error('Failed to load config');
            this.config = await response.json();
            this.applyTheme();
            return this.config;
        } catch (error) {
            console.error('Error loading config:', error);
            console.error('⚙️ [CONFIG ERROR] Failed to load config.json, using defaults:', error.message);
            // Show error in UI if possible
            this.showConfigError();
            return this.getDefaultConfig();
        }
    }

    applyTheme() {
        if (!this.config) return;
        
        const root = document.documentElement;
        const { colors, rarityColors } = this.config.theme;
        
        // Apply theme colors
        root.style.setProperty('--bg-primary', colors.primary);
        root.style.setProperty('--bg-secondary', colors.secondary);
        root.style.setProperty('--bg-tertiary', colors.tertiary);
        root.style.setProperty('--text-primary', colors.text);
        root.style.setProperty('--text-secondary', colors.textSecondary);
        root.style.setProperty('--accent-primary', colors.accent);
        root.style.setProperty('--accent-hover', colors.accentHover);
        
        // Apply rarity colors
        root.style.setProperty('--rarity-common', rarityColors.common);
        root.style.setProperty('--rarity-uncommon', rarityColors.uncommon);
        root.style.setProperty('--rarity-rare', rarityColors.rare);
        root.style.setProperty('--rarity-epic', rarityColors.epic);
        root.style.setProperty('--rarity-legendary', rarityColors.legendary);
        
        // Apply animation duration
        root.style.setProperty('--roll-duration', `${this.config.animation.rollDuration}ms`);
        
        // Apply glow effects setting
        if (this.config.display.showGlowEffects) {
            document.body.classList.add('show-glow-effects');
        } else {
            document.body.classList.remove('show-glow-effects');
        }
    }

    showConfigError() {
        // Try to show error in UI
        setTimeout(() => {
            const caseContainer = document.querySelector('.case-container');
            if (caseContainer) {
                const errorContainer = document.createElement('div');
                errorContainer.className = 'final-emote-container';
                const title = document.createElement('div');
                title.className = 'cat-title';
                title.textContent = 'Cat Of The Day';

                const message = document.createElement('div');
                message.className = 'waiting-message error';

                const status = document.createElement('div');
                status.className = 'waiting-status error';
                status.textContent = 'CONFIG LOAD FAILED';

                const instruction = document.createElement('div');
                instruction.className = 'waiting-instruction';
                instruction.textContent = 'Failed to load config.json. Using default configuration.';

                message.appendChild(status);
                message.appendChild(instruction);
                errorContainer.appendChild(title);
                errorContainer.appendChild(message);
                caseContainer.replaceChildren();
                caseContainer.appendChild(errorContainer);
            }
        }, 100);
    }

    getDefaultConfig() {
        return {
            channel: { name: "YourChannelName", displayChannelName: true },
            theme: {
                colors: {
                    primary: "#1a1a1a", secondary: "#2d2d2d", tertiary: "#3d3d3d",
                    accent: "#00aaff", accentHover: "#0088cc", text: "#ffffff", textSecondary: "#cccccc"
                },
                rarityColors: {
                    common: "#b0b0b0", uncommon: "#5e98d9", rare: "#4b69ff", epic: "#8847ff", legendary: "#d32ce6"
                }
            },
            animation: { rollDuration: 4000, enableSounds: true, autoStart: true, autoStartDelay: 500 },
            audio: { 
                rollingSound: "gamba.mp3", 
                winSound: { useCustom: false, customFile: "ding.mp3", volume: 0.5 }
            },
            persistence: { enableWinnerMemory: false, winnerDurationHours: 24, allowRollCommand: true, showTimeRemaining: false },
            emotes: { source: "7tv", channelName: "", globalEmotes: true, maxEmotes: 50, enableAnimated: true },
            rarity: { weights: { common: 55, uncommon: 25, rare: 12, epic: 6, legendary: 2 }, assignmentMethod: "position" },
            display: { showRarityBorders: true, showGlowEffects: true, showLoadingSpinner: true, finalEmoteSize: "large" },
            debug: { enableLogging: true, showFallbackEmotes: false },
            twitch: { 
                enableChatCommands: false, allowModerators: true, allowBroadcaster: true, allowSubscribers: false,
                commands: { roll: "#roll", set: "#set" },
                channelPoints: { enabled: false, rewardTitle: "", listenToAllRewards: true, specificRewardId: "" },
                oauth: { clientId: "", accessToken: "", scopes: ["channel:read:redemptions"] }
            }
        };
    }
}

// ===== 7TV API INTEGRATION =====
class SevenTVAPI {
    constructor(config) {
        this.baseURL = 'https://7tv.io/v3';
        this.config = config;
        this.emotes = [];
    }

    async fetchEmotes() {
        try {
            let channelEmotes = [];
            let globalEmotes = [];
            
            // If channel ID is specified, fetch channel emotes using the correct endpoint
            if (this.config.emotes.channelID && this.config.emotes.channelID.trim() !== '') {
                if (this.config.debug.enableLogging) {
                    console.log('🔍 Fetching emotes for channel ID:', this.config.emotes.channelID);
                }
                try {
                    const url = `https://7tv.io/v3/users/twitch/${this.config.emotes.channelID}`;
                    if (this.config.debug.enableLogging) {
                        console.log('Fetching from URL:', url);
                    }
                    const channelResponse = await fetch(url);
                    if (this.config.debug.enableLogging) {
                        console.log('Channel response status:', channelResponse.status);
                    }
                    
                    if (channelResponse.ok) {
                        const channelData = await channelResponse.json();
                        if (this.config.debug.enableLogging) {
                            console.log('✅ Channel data received:', channelData);
                        }
                        
                        // Check for emote_set structure
                        if (channelData.emote_set && channelData.emote_set.emotes) {
                            if (this.config.debug.enableLogging) {
                                console.log('Found channel emote set with', channelData.emote_set.emotes.length, 'emotes');
                            }
                            channelEmotes = channelData.emote_set.emotes;
                        } 
                        // Check for direct emotes array
                        else if (channelData.emotes) {
                            if (this.config.debug.enableLogging) {
                                console.log('Found direct emotes array with', channelData.emotes.length, 'emotes');
                            }
                            channelEmotes = channelData.emotes;
                        } else {
                            if (this.config.debug.enableLogging) {
                                console.log('⚠️ Channel found but no recognizable emote structure:', Object.keys(channelData));
                            }
                        }
                    } else {
                        const errorData = await channelResponse.json().catch(() => ({}));
                        if (this.config.debug.enableLogging) {
                            console.log('❌ Channel lookup failed:', errorData);
                            console.log('Response status:', channelResponse.status, channelResponse.statusText);
                        }
                    }
                } catch (e) {
                    console.error('Error fetching channel emotes:', e);
                }
            }
            
            // Also fetch global emotes if enabled
            if (this.config.emotes.globalEmotes) {
                if (this.config.debug.enableLogging) {
                    console.log('📡 Fetching global emotes');
                }
                let url = `${this.baseURL}/emote-sets/global`;
                if (this.config.debug.enableLogging) {
                    console.log('Fetching global emotes from:', url);
                }
                const response = await fetch(url);
                if (this.config.debug.enableLogging) {
                    console.log('Global response status:', response.status);
                }
                
                if (response.ok) {
                    const data = await response.json();
                    if (this.config.debug.enableLogging) {
                        console.log('Global data received with', data.emotes?.length || 0, 'emotes');
                        console.log('Sample global emotes:', data.emotes?.slice(0, 5).map(e => e.name));
                    }
                    globalEmotes = data.emotes || [];
                } else {
                    if (this.config.debug.enableLogging) {
                        console.log('❌ Failed to fetch global emotes');
                    }
                }
            }
            
            // Combine emotes - prioritize channel emotes, then add global emotes
            let allEmotes = [...channelEmotes];
            if (this.config.emotes.globalEmotes) {
                // Add global emotes that don't have the same name as channel emotes
                const channelEmoteNames = new Set(channelEmotes.map(e => e.name));
                const uniqueGlobalEmotes = globalEmotes.filter(e => !channelEmoteNames.has(e.name));
                allEmotes = [...channelEmotes, ...uniqueGlobalEmotes];
            }
            
            if (this.config.debug.enableLogging) {
                console.log(`📊 Total emotes available: ${allEmotes.length} (Channel: ${channelEmotes.length}, Global: ${globalEmotes.length})`);
                console.log('Sample combined emotes:', allEmotes.slice(0, 10).map(e => e.name));
            }
            
            return this.processEmotes(allEmotes);
        } catch (error) {
            console.error('Error fetching 7TV emotes:', error);
            console.error('🔥 [API ERROR] Failed to fetch emotes from 7TV API:', error.message);
            return this.getFallbackEmotes();
        }
    }

    processEmotes(emotes) {
        if (this.config.debug.enableLogging) {
            console.log('=== EMOTE PROCESSING DEBUG ===');
            console.log('Total emotes fetched:', emotes.length);
            console.log('All emotes:', emotes.map(e => e.name).join(', '));
        }
        
        // If target emotes are specified, filter for only those
        let filteredEmotes = emotes;
        if (this.config.emotes.targetEmotes && this.config.emotes.targetEmotes.length > 0) {
            if (this.config.debug.enableLogging) {
                console.log('Target emotes specified:', this.config.emotes.targetEmotes);
            }
            
            filteredEmotes = emotes.filter(emote => 
                emote && emote.name && 
                this.config.emotes.targetEmotes.includes(emote.name)
            );
            
            if (this.config.debug.enableLogging) {
                console.log('Found target emotes:', filteredEmotes.map(e => e.name));
            }
            
            // ONLY use target emotes - no fallback to all emotes
            if (filteredEmotes.length === 0) {
                if (this.config.debug.enableLogging) {
                    console.log('❌ No target emotes found in channel! Using fallback emotes.');
                }
                return this.getFallbackEmotes();
            } else {
                if (this.config.debug.enableLogging) {
                    console.log('✅ Using ONLY target emotes found in channel');
                }
            }
        } else {
            if (this.config.debug.enableLogging) {
                console.log('No target emotes specified, using all channel emotes');
            }
        }
        
        // Filter and process emotes
        const maxEmotes = this.config.emotes.maxEmotes || 50;
        const filteredAndSliced = filteredEmotes
            .filter(emote => {
                if (!emote || !emote.name || !emote.id) return false;
                // Filter out animated emotes if disabled
                if (!this.config.emotes.enableAnimated && emote.animated) return false;
                return true;
            })
            .slice(0, maxEmotes);
            
        // Shuffle the array to randomize rarity assignments
        const shuffledEmotes = this.shuffleArray([...filteredAndSliced]);
        
        const processedEmotes = shuffledEmotes
            .map((emote, index) => {
                const imageUrl = this.getEmoteImageURL(emote.id, '4x');
                const fallbackUrl = this.getEmoteImageURL(emote.id, '2x');
                if (this.config.debug.enableLogging) {
                    console.log(`Processing emote: ${emote.name} (ID: ${emote.id})`);
                    console.log(`Image URL: ${imageUrl}`);
                }
                
                return {
                    id: emote.id,
                    name: emote.name,
                    imageUrl: imageUrl,
                    fallbackUrl: fallbackUrl,
                    animated: emote.animated || false,
                    rarity: this.assignRarity(index, shuffledEmotes.length)
                };
            });

        if (this.config.debug.enableLogging) {
            console.log('Final processed emotes:', processedEmotes.map(e => `${e.name} -> ${e.imageUrl}`));
            console.log('=== END EMOTE DEBUG ===');
        }
        
        return processedEmotes.length > 0 ? processedEmotes : this.getFallbackEmotes();
    }

    getEmoteImageURL(emoteId, size = '2x') {
        // Try different formats for better compatibility
        return `https://cdn.7tv.app/emote/${emoteId}/${size}`;
    }

    shuffleArray(array) {
        // Fisher-Yates shuffle algorithm
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    assignRarity(index, total) {
        // Assign rarities based on position (earlier emotes are rarer)
        const percentage = (index / total) * 100;
        
        if (percentage <= 2) return 'legendary';   // First 2%
        if (percentage <= 8) return 'epic';       // Next 6%
        if (percentage <= 20) return 'rare';      // Next 12%
        if (percentage <= 45) return 'uncommon';  // Next 25%
        return 'common';                          // Remaining 55%
    }

    getFallbackEmotes() {
        // Create simple, visible placeholder images for each emote
        const createEmoteImage = (name, color) => {
            return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50" fill="${color}" stroke="white" stroke-width="2" rx="5"/><text x="25" y="30" text-anchor="middle" fill="white" font-family="Arial" font-size="8" font-weight="bold">${name.slice(0,6)}</text></svg>`)}`;
        };

        // Fallback emotes in case API fails - include target emotes if specified
        const fallbackEmotes = [
            { id: '1', name: 'MEOW', imageUrl: createEmoteImage('MEOW', '#d32ce6'), rarity: 'legendary', animated: false },
            { id: '2', name: 'Applecatgun', imageUrl: createEmoteImage('Apple', '#d32ce6'), rarity: 'legendary', animated: false },
            { id: '3', name: 'Bananacatrun', imageUrl: createEmoteImage('Banana', '#8847ff'), rarity: 'epic', animated: true },
            { id: '4', name: 'CatAHomie', imageUrl: createEmoteImage('Homie', '#8847ff'), rarity: 'epic', animated: false },
            { id: '5', name: 'YesYes', imageUrl: createEmoteImage('Yes', '#4b69ff'), rarity: 'rare', animated: false },
            { id: '6', name: 'NoNo', imageUrl: createEmoteImage('No', '#4b69ff'), rarity: 'rare', animated: false },
            { id: '7', name: 'MYAA', imageUrl: createEmoteImage('MYAA', '#5e98d9'), rarity: 'uncommon', animated: false },
            { id: '8', name: 'FlushedCat', imageUrl: createEmoteImage('Flush', '#5e98d9'), rarity: 'uncommon', animated: false },
            { id: '9', name: 'catScream', imageUrl: createEmoteImage('Scream', '#b0b0b0'), rarity: 'common', animated: false },
            { id: '10', name: 'catFlip', imageUrl: createEmoteImage('Flip', '#b0b0b0'), rarity: 'common', animated: false },
            { id: '11', name: 'catKISS', imageUrl: createEmoteImage('KISS', '#b0b0b0'), rarity: 'common', animated: false },
            { id: '12', name: 'RAGEY', imageUrl: createEmoteImage('RAGE', '#5e98d9'), rarity: 'uncommon', animated: false },
            { id: '13', name: 'FLASHBANG', imageUrl: createEmoteImage('FLASH', '#4b69ff'), rarity: 'rare', animated: false }
        ];
        
        // If target emotes are specified, ONLY use those
        if (this.config.emotes.targetEmotes && this.config.emotes.targetEmotes.length > 0) {
            console.log('🔄 Using fallback emotes, filtering for target emotes only');
            const targetFallbacks = fallbackEmotes.filter(emote => 
                this.config.emotes.targetEmotes.includes(emote.name)
            );
            console.log('Fallback target emotes found:', targetFallbacks.map(e => e.name));
            return targetFallbacks; // Always return only target emotes, even if empty
        }
        
        console.log('No target emotes specified, using all fallback emotes');
        return fallbackEmotes;
    }

    generatePlaceholderSVG(name, color) {
        const svg = `<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50" fill="${color}" stroke="${color}" stroke-width="2" rx="5"/><text x="25" y="30" text-anchor="middle" fill="white" font-family="Arial" font-size="10" font-weight="bold">${name.slice(0, 6)}</text></svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
}

// ===== WINNER PERSISTENCE SYSTEM =====
class WinnerPersistence {
    constructor(config, caseOpening) {
        this.config = config;
        this.caseOpening = caseOpening;
        this.storageKey = 'catOfTheDayWinner';
    }

    // Save winner with timestamp
    saveWinner(emote) {
        const winnerData = {
            emote: emote,
            timestamp: Date.now(),
            expiresAt: Date.now() + (this.config.persistence.winnerDurationHours * 60 * 60 * 1000)
        };
        
        localStorage.setItem(this.storageKey, JSON.stringify(winnerData));
        
        if (this.config.debug.enableLogging) {
            console.log('💾 [PERSISTENCE] Winner saved:', emote.name);
            console.log('💾 [PERSISTENCE] Expires at:', new Date(winnerData.expiresAt).toLocaleString());
        }
    }

    // Get current winner if still valid
    getCurrentWinner() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return null;

            const winnerData = JSON.parse(stored);
            const now = Date.now();

            if (now > winnerData.expiresAt) {
                // Winner expired
                this.clearWinner();
                if (this.config.debug.enableLogging) {
                    console.log('💾 [PERSISTENCE] Winner expired, cleared from storage');
                }
                return null;
            }

            if (this.config.debug.enableLogging) {
                const timeLeft = winnerData.expiresAt - now;
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                console.log(`💾 [PERSISTENCE] Current winner: ${winnerData.emote.name}`);
                console.log(`💾 [PERSISTENCE] Time remaining: ${hoursLeft}h ${minutesLeft}m`);
            }

            return winnerData;
        } catch (error) {
            console.error('💾 [PERSISTENCE] Error loading winner:', error);
            this.clearWinner();
            return null;
        }
    }

    // Check if winner has expired
    isWinnerExpired() {
        const winner = this.getCurrentWinner();
        return winner === null;
    }

    // Get time remaining in milliseconds
    getTimeRemaining() {
        const winner = this.getCurrentWinner();
        if (!winner) return 0;
        
        return Math.max(0, winner.expiresAt - Date.now());
    }

    // Get time remaining formatted as string
    getTimeRemainingFormatted() {
        const timeLeft = this.getTimeRemaining();
        if (timeLeft === 0) return "Expired";

        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Clear winner from storage
    clearWinner() {
        localStorage.removeItem(this.storageKey);
        if (this.config.debug.enableLogging) {
            console.log('💾 [PERSISTENCE] Winner cleared from storage');
        }
    }

    // Force new roll (for commands)
    forceNewRoll() {
        this.clearWinner();
        if (this.config.debug.enableLogging) {
            console.log('💾 [PERSISTENCE] Forced new roll - winner cleared');
        }
        // Trigger the actual roll animation
        setTimeout(() => this.caseOpening.openCase(), 500);
    }
}

// ===== WINNER HISTORY TRACKER =====
class WinnerHistoryManager {
    constructor(config) {
        this.config = config;
        this.storageKey = 'catOfTheDayHistory';
        this.maxHistorySize = 1000; // Keep last 1000 winners
    }

    // Add a winner to history
    addWinner(emote) {
        const history = this.getHistory();
        
        const entry = {
            emote: {
                name: emote.name,
                rarity: emote.rarity,
                imageUrl: emote.imageUrl
            },
            timestamp: Date.now(),
            date: new Date().toISOString()
        };
        
        history.unshift(entry); // Add to beginning
        
        // Keep only the last maxHistorySize entries
        if (history.length > this.maxHistorySize) {
            history.splice(this.maxHistorySize);
        }
        
        localStorage.setItem(this.storageKey, JSON.stringify(history));
        
        if (this.config.debug && this.config.debug.enableLogging) {
            console.log('📊 [HISTORY] Winner added to history:', emote.name, '(' + emote.rarity + ')');
            console.log('📊 [HISTORY] Total entries:', history.length);
        }
        
        return entry;
    }

    // Get full history
    getHistory() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return [];
            return JSON.parse(stored);
        } catch (error) {
            console.error('📊 [HISTORY] Error loading history:', error);
            return [];
        }
    }

    // Get statistics
    getStatistics() {
        const history = this.getHistory();
        
        const stats = {
            totalRolls: history.length,
            byRarity: {
                common: 0,
                uncommon: 0,
                rare: 0,
                epic: 0,
                legendary: 0
            },
            byEmote: {},
            firstRoll: history[history.length - 1]?.date || null,
            lastRoll: history[0]?.date || null
        };
        
        history.forEach(entry => {
            // Count by rarity
            if (entry.emote.rarity) {
                stats.byRarity[entry.emote.rarity]++;
            }
            
            // Count by emote name
            const emoteName = entry.emote.name;
            if (!stats.byEmote[emoteName]) {
                stats.byEmote[emoteName] = {
                    count: 0,
                    rarity: entry.emote.rarity
                };
            }
            stats.byEmote[emoteName].count++;
        });
        
        return stats;
    }

    // Export history as JSON file download
    exportHistory() {
        const history = this.getHistory();
        const stats = this.getStatistics();
        
        const exportData = {
            exportDate: new Date().toISOString(),
            statistics: stats,
            history: history
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `cat-of-the-day-history-${Date.now()}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        console.log('📊 [HISTORY] History exported:', history.length, 'entries');
    }

    // Clear all history
    clearHistory() {
        localStorage.removeItem(this.storageKey);
        console.log('📊 [HISTORY] History cleared');
    }

    // Import history from JSON
    importHistory(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            const history = data.history || data; // Support both full export format and plain array
            
            localStorage.setItem(this.storageKey, JSON.stringify(history));
            console.log('📊 [HISTORY] History imported:', history.length, 'entries');
            return true;
        } catch (error) {
            console.error('📊 [HISTORY] Error importing history:', error);
            return false;
        }
    }
}

// ===== GITHUB GIST CLOUD BACKUP =====
class GistBackupManager {
    constructor(config, historyManager) {
        this.config = config;
        this.historyManager = historyManager;
        this.gistId = localStorage.getItem('catOfTheDayGistId') || null;
        this.githubToken = this.config.backup?.githubToken || null;
        this.autoBackupEnabled = this.config.backup?.autoBackup || false;
        this.autoBackupInterval = this.config.backup?.autoBackupMinutes || 60; // Default 60 minutes
        this.lastBackupTime = parseInt(localStorage.getItem('lastGistBackupTime')) || 0;
        this.autoBackupTimer = null;
        this.enabled = !!(this.githubToken && this.githubToken.trim() !== '');
        
        if (this.enabled && this.autoBackupEnabled && this.gistId) {
            this.startAutoBackup();
        }
    }

    // Create or update gist with history
    async syncToGist(description = 'Cat of the Day - Winner History') {
        if (!this.enabled || !this.githubToken || this.githubToken.trim() === '') {
            console.error('☁️ [GIST] No GitHub token configured');
            console.log('☁️ [GIST] Add "backup": {"githubToken": "your_token"} to config.json');
            console.log('☁️ [GIST] Get a token at: https://github.com/settings/tokens');
            return { success: false, error: 'No GitHub token' };
        }

        try {
            const history = this.historyManager.getHistory();
            const stats = this.historyManager.getStatistics();
            
            const exportData = {
                lastUpdated: new Date().toISOString(),
                statistics: stats,
                history: history,
                config: {
                    channel: this.config.channel?.name || 'unknown',
                    totalEmotes: this.config.emotes?.targetEmotes?.length || 0
                }
            };

            const gistData = {
                description: description,
                public: false,
                files: {
                    'cat-of-the-day-history.json': {
                        content: JSON.stringify(exportData, null, 2)
                    }
                }
            };

            let response;
            if (this.gistId) {
                // Update existing gist
                console.log('☁️ [GIST] Updating existing gist:', this.gistId);
                response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${this.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(gistData)
                });
            } else {
                // Create new gist
                console.log('☁️ [GIST] Creating new gist...');
                response = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${this.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(gistData)
                });
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            const result = await response.json();
            
            if (!this.gistId) {
                this.gistId = result.id;
                localStorage.setItem('catOfTheDayGistId', this.gistId);
            }

            this.lastBackupTime = Date.now();
            localStorage.setItem('lastGistBackupTime', this.lastBackupTime.toString());

            console.log('☁️ [GIST] ✅ Backup successful!');
            console.log('☁️ [GIST] Gist ID:', this.gistId);
            console.log('☁️ [GIST] URL:', result.html_url);
            console.log('☁️ [GIST] Entries backed up:', history.length);

            return { 
                success: true, 
                gistId: this.gistId, 
                url: result.html_url,
                entriesBackedUp: history.length
            };

        } catch (error) {
            console.error('☁️ [GIST] Backup failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Restore history from gist
    async restoreFromGist(gistId = this.gistId) {
        if (!gistId) {
            console.error('☁️ [GIST] No gist ID provided');
            return { success: false, error: 'No gist ID' };
        }

        try {
            console.log('☁️ [GIST] Fetching gist:', gistId);
            
            const headers = {
                'Accept': 'application/vnd.github.v3+json'
            };
            
            if (this.githubToken) {
                headers['Authorization'] = `token ${this.githubToken}`;
            }

            const response = await fetch(`https://api.github.com/gists/${gistId}`, { headers });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const gist = await response.json();
            const file = gist.files['cat-of-the-day-history.json'];
            
            if (!file) {
                throw new Error('History file not found in gist');
            }

            const data = JSON.parse(file.content);
            const imported = this.historyManager.importHistory(data);

            if (imported) {
                console.log('☁️ [GIST] ✅ Restore successful!');
                console.log('☁️ [GIST] Entries restored:', data.history?.length || 0);
                
                // Save gist ID for future syncs
                this.gistId = gistId;
                localStorage.setItem('catOfTheDayGistId', gistId);
                
                return { 
                    success: true, 
                    entriesRestored: data.history?.length || 0,
                    lastUpdated: data.lastUpdated
                };
            } else {
                throw new Error('Failed to import history');
            }

        } catch (error) {
            console.error('☁️ [GIST] Restore failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Start automatic backup
    startAutoBackup() {
        if (this.autoBackupTimer) {
            clearInterval(this.autoBackupTimer);
        }

        console.log(`☁️ [GIST] Auto-backup enabled (every ${this.autoBackupInterval} minutes)`);
        
        this.autoBackupTimer = setInterval(async () => {
            console.log('☁️ [GIST] Running automatic backup...');
            await this.syncToGist('Cat of the Day - Auto Backup');
        }, this.autoBackupInterval * 60 * 1000);
    }

    // Stop automatic backup
    stopAutoBackup() {
        if (this.autoBackupTimer) {
            clearInterval(this.autoBackupTimer);
            this.autoBackupTimer = null;
            console.log('☁️ [GIST] Auto-backup stopped');
        }
    }

    // Get backup info
    getBackupInfo() {
        const info = {
            hasGistId: !!this.gistId,
            gistId: this.gistId,
            hasToken: !!this.githubToken,
            autoBackupEnabled: this.autoBackupEnabled,
            autoBackupInterval: this.autoBackupInterval,
            lastBackupTime: this.lastBackupTime,
            lastBackupFormatted: this.lastBackupTime ? new Date(this.lastBackupTime).toLocaleString() : 'Never'
        };
        
        console.log('☁️ [GIST] Backup Info:', info);
        return info;
    }
}

// ===== SYSTEM HEALTH CHECK =====
class HealthCheckManager {
    constructor(caseOpening) {
        this.caseOpening = caseOpening;
    }

    // Run full system health check
    async runHealthCheck() {
        console.log('🏥 [HEALTH] Running system health check...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const results = {
            timestamp: new Date().toISOString(),
            overall: 'healthy',
            checks: {}
        };

        // 1. Config Check
        results.checks.config = this.checkConfig();
        
        // 2. Emotes Check
        results.checks.emotes = this.checkEmotes();
        
        // 3. Audio Check
        results.checks.audio = this.checkAudio();
        
        // 4. Persistence Check
        results.checks.persistence = this.checkPersistence();
        
        // 5. History Check
        results.checks.history = this.checkHistory();
        
        // 6. Twitch EventSub Check
        results.checks.eventSub = await this.checkEventSub();
        
        // 7. 7TV API Check
        results.checks.sevenTV = await this.check7TVAPI();
        
        // 8. Browser Storage Check
        results.checks.storage = this.checkStorage();
        
        // 9. Backup Check
        results.checks.backup = this.checkBackup();

        // Determine overall health
        const failedChecks = Object.values(results.checks).filter(c => c.status === 'error');
        const warningChecks = Object.values(results.checks).filter(c => c.status === 'warning');
        
        if (failedChecks.length > 0) {
            results.overall = 'unhealthy';
        } else if (warningChecks.length > 0) {
            results.overall = 'degraded';
        }

        // Print summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🏥 [HEALTH] Overall Status: ${results.overall.toUpperCase()}`);
        console.log(`🏥 [HEALTH] Checks Passed: ${Object.values(results.checks).filter(c => c.status === 'ok').length}/${Object.keys(results.checks).length}`);
        console.log(`🏥 [HEALTH] Warnings: ${warningChecks.length}`);
        console.log(`🏥 [HEALTH] Errors: ${failedChecks.length}`);
        
        if (failedChecks.length > 0) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('❌ FAILED CHECKS:');
            failedChecks.forEach(check => {
                console.log(`  • ${check.name}: ${check.message}`);
            });
        }
        
        if (warningChecks.length > 0) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('⚠️  WARNINGS:');
            warningChecks.forEach(check => {
                console.log(`  • ${check.name}: ${check.message}`);
            });
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return results;
    }

    checkConfig() {
        const check = { name: 'Configuration', status: 'ok', message: 'Config loaded successfully' };
        
        if (!this.caseOpening.config) {
            check.status = 'error';
            check.message = 'Config not loaded';
        } else if (!this.caseOpening.config.emotes?.channelID) {
            check.status = 'warning';
            check.message = 'No channel ID configured';
        }
        
        console.log(`${this.getStatusIcon(check.status)} Configuration: ${check.message}`);
        return check;
    }

    checkEmotes() {
        const check = { name: 'Emotes', status: 'ok', message: `${this.caseOpening.emotes.length} emotes loaded` };
        
        if (!this.caseOpening.emotes || this.caseOpening.emotes.length === 0) {
            check.status = 'error';
            check.message = 'No emotes loaded';
        } else if (this.caseOpening.emotes.length < 10) {
            check.status = 'warning';
            check.message = `Only ${this.caseOpening.emotes.length} emotes loaded (recommend 10+)`;
        }
        
        console.log(`${this.getStatusIcon(check.status)} Emotes: ${check.message}`);
        return check;
    }

    checkAudio() {
        const check = { name: 'Audio System', status: 'ok', message: 'Audio system initialized' };
        
        if (!this.caseOpening.audioManager) {
            check.status = 'error';
            check.message = 'Audio manager not initialized';
        } else if (!this.caseOpening.audioManager.gambaAudio) {
            check.status = 'warning';
            check.message = 'Rolling sound not loaded';
        }
        
        console.log(`${this.getStatusIcon(check.status)} Audio: ${check.message}`);
        return check;
    }

    checkPersistence() {
        const check = { name: 'Winner Persistence', status: 'ok', message: 'Persistence system ready' };
        
        if (this.caseOpening.config.persistence?.enableWinnerMemory) {
            if (!this.caseOpening.winnerPersistence) {
                check.status = 'error';
                check.message = 'Persistence enabled but not initialized';
            } else {
                const current = this.caseOpening.winnerPersistence.getCurrentWinner();
                check.message = current ? `Active winner: ${current.emote.name}` : 'No active winner';
            }
        } else {
            check.status = 'warning';
            check.message = 'Persistence disabled in config';
        }
        
        console.log(`${this.getStatusIcon(check.status)} Persistence: ${check.message}`);
        return check;
    }

    checkHistory() {
        const check = { name: 'Winner History', status: 'ok', message: 'History tracking active' };
        
        if (!this.caseOpening.winnerHistory) {
            check.status = 'error';
            check.message = 'History manager not initialized';
        } else {
            const stats = this.caseOpening.winnerHistory.getStatistics();
            check.message = `${stats.totalRolls} total rolls tracked`;
            
            if (stats.totalRolls === 0) {
                check.status = 'warning';
                check.message = 'No history recorded yet';
            }
        }
        
        console.log(`${this.getStatusIcon(check.status)} History: ${check.message}`);
        return check;
    }

    async checkEventSub() {
        const check = { name: 'Twitch EventSub', status: 'ok', message: 'EventSub ready' };
        
        if (!this.caseOpening.config.twitch?.channelPoints?.enabled) {
            check.status = 'warning';
            check.message = 'Channel points disabled';
        } else if (!this.caseOpening.twitchEventSub) {
            check.status = 'error';
            check.message = 'EventSub manager not initialized';
        } else if (!this.caseOpening.twitchEventSub.connected) {
            check.status = 'warning';
            check.message = 'Not connected to EventSub';
        } else {
            check.message = 'Connected to EventSub WebSocket';
        }
        
        console.log(`${this.getStatusIcon(check.status)} EventSub: ${check.message}`);
        return check;
    }

    async check7TVAPI() {
        const check = { name: '7TV API', status: 'ok', message: '7TV API accessible' };
        
        try {
            const response = await fetch('https://7tv.io/v3/emote-sets/global', { 
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                check.status = 'warning';
                check.message = `7TV API returned ${response.status}`;
            }
        } catch (error) {
            check.status = 'error';
            check.message = `Cannot reach 7TV API: ${error.message}`;
        }
        
        console.log(`${this.getStatusIcon(check.status)} 7TV API: ${check.message}`);
        return check;
    }

    checkStorage() {
        const check = { name: 'Browser Storage', status: 'ok', message: 'localStorage available' };
        
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            
            // Check storage usage
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length + key.length;
                }
            }
            
            const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
            check.message = `localStorage available (${sizeMB} MB used)`;
            
            if (totalSize > 5 * 1024 * 1024) { // 5MB warning
                check.status = 'warning';
                check.message = `localStorage usage high: ${sizeMB} MB`;
            }
        } catch (error) {
            check.status = 'error';
            check.message = 'localStorage not available';
        }
        
        console.log(`${this.getStatusIcon(check.status)} Storage: ${check.message}`);
        return check;
    }

    checkBackup() {
        const check = { name: 'Cloud Backup', status: 'ok', message: 'Backup system ready' };
        
        if (!this.caseOpening.gistBackup) {
            check.status = 'warning';
            check.message = 'Backup manager not initialized';
        } else {
            const info = this.caseOpening.gistBackup.getBackupInfo();
            
            if (!info.hasToken) {
                check.status = 'warning';
                check.message = 'No GitHub token configured';
            } else if (!info.hasGistId) {
                check.status = 'warning';
                check.message = 'No gist created yet (run syncToGist())';
            } else {
                check.message = `Last backup: ${info.lastBackupFormatted}`;
                
                // Warn if backup is old (>7 days)
                if (info.lastBackupTime && Date.now() - info.lastBackupTime > 7 * 24 * 60 * 60 * 1000) {
                    check.status = 'warning';
                    check.message += ' (backup is old)';
                }
            }
        }
        
        console.log(`${this.getStatusIcon(check.status)} Backup: ${check.message}`);
        return check;
    }

    getStatusIcon(status) {
        const icons = {
            'ok': '✅',
            'warning': '⚠️',
            'error': '❌'
        };
        return icons[status] || '❓';
    }
}

// ===== AUDIO SYSTEM =====
class AudioManager {
    constructor(config = null) {
        this.context = null;
        this.gambaAudio = null;
        this.config = config;
        this.initAudio();
    }

    async initAudio() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            
            // Load rolling sound audio file
            const rollingFile = this.config?.audio?.rollingSound || 'gamba.mp3';
            this.gambaAudio = new Audio(rollingFile);
            this.gambaAudio.loop = false;
            this.gambaAudio.volume = 0.3; // Set volume to 30%
            
            // Load custom win sound if configured
            if (this.config?.audio?.winSound?.useCustom && this.config?.audio?.winSound?.customFile) {
                this.customWinAudio = new Audio(this.config.audio.winSound.customFile);
                this.customWinAudio.volume = this.config.audio.winSound.volume || 0.5;
            }
            
            if (this.config && this.config.debug && this.config.debug.enableLogging) {
                console.log(`🎵 [AUDIO] Audio system initialized - ${rollingFile} loaded, loop=false, volume=30%`);
                if (this.customWinAudio) {
                    console.log(`🎵 [AUDIO] Custom win sound loaded: ${this.config.audio.winSound.customFile}`);
                }
            }
        } catch (e) {
            console.log('Audio not supported');
        }
    }

    playRollSound() {
        if (!this.context) return;
        
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);
        
        oscillator.frequency.setValueAtTime(200, this.context.currentTime);
        gainNode.gain.setValueAtTime(0.1, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);
        
        oscillator.start(this.context.currentTime);
        oscillator.stop(this.context.currentTime + 0.1);
    }

    startGambaMusic() {
        if (this.gambaAudio) {
            try {
                if (this.config && this.config.debug && this.config.debug.enableLogging) {
                    console.log('🎵 Starting gamba music (5 second duration)');
                    console.log('🎵 Audio duration:', this.gambaAudio.duration, 'seconds');
                }
                
                // Add event listeners to track audio behavior
                this.gambaAudio.onended = () => {
                    if (this.config && this.config.debug && this.config.debug.enableLogging) {
                        console.log('🎵 Audio ended naturally at', this.gambaAudio.currentTime, 'seconds');
                    }
                };
                
                this.gambaAudio.onpause = () => {
                    if (this.config && this.config.debug && this.config.debug.enableLogging) {
                        console.log('🎵 Audio paused at', this.gambaAudio.currentTime, 'seconds');
                    }
                };
                
                this.gambaAudio.onerror = (e) => {
                    console.log('🎵 Audio error:', e);
                };
                
                // Stop any currently playing audio first
                this.gambaAudio.pause();
                this.gambaAudio.currentTime = 0; // Reset to beginning
                
                // Ensure audio is loaded and ready
                this.gambaAudio.load();
                
                // Start playing
                this.gambaAudio.play().then(() => {
                    if (this.config && this.config.debug && this.config.debug.enableLogging) {
                        console.log('🎵 Gamba music started successfully at time:', this.gambaAudio.currentTime);
                        
                        // Monitor audio progress
                        const checkProgress = setInterval(() => {
                            if (this.gambaAudio.paused || this.gambaAudio.ended) {
                                console.log('🎵 Audio monitoring stopped - paused:', this.gambaAudio.paused, 'ended:', this.gambaAudio.ended);
                                clearInterval(checkProgress);
                            } else {
                                console.log('🎵 Audio playing at:', this.gambaAudio.currentTime.toFixed(1) + 's');
                            }
                        }, 1000); // Check every second
                    }
                }).catch(e => console.log('Could not play gamba audio:', e));
            } catch (e) {
                console.log('Error starting gamba music:', e);
            }
        }
    }

    stopGambaMusic() {
        if (this.gambaAudio) {
            try {
                if (this.config && this.config.debug && this.config.debug.enableLogging) {
                    console.log('🎵 Stopping gamba music at', this.gambaAudio.currentTime, 'seconds');
                }
                this.gambaAudio.pause();
                this.gambaAudio.currentTime = 0;
            } catch (e) {
                console.log('Error stopping gamba music:', e);
            }
        }
    }

    playWinSound(rarity) {
        // Use custom win sound if configured
        if (this.customWinAudio && this.config?.audio?.winSound?.useCustom) {
            try {
                this.customWinAudio.currentTime = 0; // Reset to beginning
                this.customWinAudio.play();
                if (this.config.debug && this.config.debug.enableLogging) {
                    console.log('🎵 [AUDIO] Playing custom win sound');
                }
                return;
            } catch (e) {
                console.log('Custom win sound failed, falling back to generated tones');
            }
        }
        
        // Fallback to generated tones
        if (!this.context) return;
        
        const frequencies = {
            common: [262, 330, 392],
            uncommon: [330, 415, 523],
            rare: [415, 523, 659],
            epic: [523, 659, 831],
            legendary: [659, 831, 1047, 1319]
        };

        const notes = frequencies[rarity] || frequencies.common;
        
        notes.forEach((freq, i) => {
            setTimeout(() => {
                const oscillator = this.context.createOscillator();
                const gainNode = this.context.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.context.destination);
                
                oscillator.frequency.setValueAtTime(freq, this.context.currentTime);
                gainNode.gain.setValueAtTime(0.2, this.context.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);
                
                oscillator.start(this.context.currentTime);
                oscillator.stop(this.context.currentTime + 0.3);
            }, i * 100);
        });
    }
}

// ===== TWITCH CHAT INTEGRATION =====
class TwitchChatManager {
    constructor(config, caseOpening) {
        this.config = config;
        this.caseOpening = caseOpening;
        this.socket = null;
        this.connected = false;
        
        if (this.config.debug.enableLogging) {
            console.log('💬 [TWITCH] Initializing Twitch Chat Manager');
            console.log('💬 [TWITCH] Chat commands enabled:', this.config.twitch.enableChatCommands);
            console.log('💬 [TWITCH] Channel:', this.config.channel.name);
            console.log('💬 [TWITCH] Permissions - Broadcaster:', this.config.twitch.allowBroadcaster, 'Mods:', this.config.twitch.allowModerators, 'Subs:', this.config.twitch.allowSubscribers);
        }
        
        if (this.config.twitch.enableChatCommands) {
            this.connect();
        } else if (this.config.debug.enableLogging) {
            console.log('💬 [TWITCH] Chat commands disabled in config');
        }
    }

    connect() {
        if (this.config.debug.enableLogging) {
            console.log('💬 [TWITCH] Attempting to connect to Twitch chat...');
        }
        
        try {
            // Connect to Twitch IRC WebSocket
            this.socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
            
            this.socket.onopen = () => {
                console.log('🔗 Connected to Twitch chat');
                if (this.config.debug.enableLogging) {
                    console.log('💬 [TWITCH] WebSocket connection established');
                    console.log('💬 [TWITCH] Joining channel:', this.config.channel.name.toLowerCase());
                }
                // Login as anonymous user (read-only)
                this.socket.send('PASS oauth:justinfan12345');
                this.socket.send('NICK justinfan12345');
                this.socket.send(`JOIN #${this.config.channel.name.toLowerCase()}`);
                this.connected = true;
                this.updateConnectionStatus('Connected to Twitch chat');
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.socket.onclose = () => {
                console.log('❌ Disconnected from Twitch chat');
                if (this.config.debug.enableLogging) {
                    console.log('💬 [TWITCH] Connection closed, attempting reconnect in 5 seconds...');
                }
                this.connected = false;
                this.updateConnectionStatus('Disconnected - Reconnecting...');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.connect(), 5000);
            };

            this.socket.onerror = (error) => {
                console.error('Twitch chat error:', error);
                if (this.config.debug.enableLogging) {
                    console.error('💬 [TWITCH] WebSocket error:', error);
                }
            };

        } catch (error) {
            console.error('Failed to connect to Twitch chat:', error);
            if (this.config.debug.enableLogging) {
                console.error('💬 [TWITCH] Connection failed:', error);
            }
        }
    }

    handleMessage(rawMessage) {
        if (this.config.debug.enableLogging) {
            console.log('💬 [TWITCH] Raw message received:', rawMessage);
        }
        
        const lines = rawMessage.split('\r\n');
        
        for (const line of lines) {
            if (!line) continue;
            
            // Handle PING to keep connection alive
            if (line.startsWith('PING')) {
                if (this.config.debug.enableLogging) {
                    console.log('💬 [TWITCH] PING received, sending PONG');
                }
                this.socket.send('PONG :tmi.twitch.tv');
                continue;
            }

            // Parse chat messages
            if (line.includes('PRIVMSG')) {
                this.parseCommand(line);
            }
        }
    }

    parseCommand(message) {
        try {
            // Extract user info and message content
            const userInfoMatch = message.match(/:(.+)!.+@(.+)\.tmi\.twitch\.tv/);
            const messageMatch = message.match(/PRIVMSG #\w+ :(.+)/);
            
            if (!userInfoMatch || !messageMatch) return;
            
            const username = userInfoMatch[1];
            const content = messageMatch[1].trim();
            
            if (this.config.debug.enableLogging) {
                console.log('💬 [TWITCH] Chat message from', username + ':', content);
            }
            
            // Extract badges to determine user permissions
            const badgesMatch = message.match(/badges=([^;]*)/);
            const badges = badgesMatch ? badgesMatch[1] : '';
            
            if (this.config.debug.enableLogging) {
                console.log('💬 [TWITCH] User badges:', badges);
            }
            
            // Check if user has permission
            if (!this.hasPermission(username, badges)) {
                if (this.config.debug.enableLogging) {
                    console.log('💬 [TWITCH] User', username, 'does not have permission for commands');
                }
                return;
            }

            // Process commands
            if (content.startsWith(this.config.twitch.commands.roll)) {
                if (this.config.debug.enableLogging) {
                    console.log('💬 [TWITCH] Roll command detected from', username);
                }
                this.handleRollCommand(username);
            } else if (content.startsWith(this.config.twitch.commands.set)) {
                const emoteName = content.substring(this.config.twitch.commands.set.length).trim();
                if (this.config.debug.enableLogging) {
                    console.log('💬 [TWITCH] Set command detected from', username, 'for emote:', emoteName);
                }
                this.handleSetCommand(username, emoteName);
            }

        } catch (error) {
            console.error('Error parsing chat command:', error);
        }
    }

    hasPermission(username, badges) {
        // Twitch badges come in format: "broadcaster/1,moderator/1,subscriber/12"
        // However, broadcasters don't always have badges in IRC, so check username too
        const isBroadcaster = badges.includes('broadcaster/') || username.toLowerCase() === this.config.channel.name.toLowerCase();
        const isModerator = badges.includes('moderator/');
        const isSubscriber = badges.includes('subscriber/');
        
        if (this.config.debug.enableLogging) {
            console.log('💬 [TWITCH] Permission check for', username);
            console.log('💬 [TWITCH] Raw badges string:', badges);
            console.log('💬 [TWITCH] Channel name:', this.config.channel.name.toLowerCase());
            console.log('💬 [TWITCH] Username matches channel:', username.toLowerCase() === this.config.channel.name.toLowerCase());
            console.log('💬 [TWITCH] - Is broadcaster:', isBroadcaster, '(allowed:', this.config.twitch.allowBroadcaster + ')');
            console.log('💬 [TWITCH] - Is moderator:', isModerator, '(allowed:', this.config.twitch.allowModerators + ')');
            console.log('💬 [TWITCH] - Is subscriber:', isSubscriber, '(allowed:', this.config.twitch.allowSubscribers + ')');
        }
        
        // Check broadcaster permission
        if (isBroadcaster && this.config.twitch.allowBroadcaster) {
            if (this.config.debug.enableLogging) {
                console.log('💬 [TWITCH] ✅ Permission granted (broadcaster)');
            }
            return true;
        }
        
        // Check moderator permission
        if (isModerator && this.config.twitch.allowModerators) {
            if (this.config.debug.enableLogging) {
                console.log('💬 [TWITCH] ✅ Permission granted (moderator)');
            }
            return true;
        }
        
        // Check subscriber permission
        if (isSubscriber && this.config.twitch.allowSubscribers) {
            if (this.config.debug.enableLogging) {
                console.log('💬 [TWITCH] ✅ Permission granted (subscriber)');
            }
            return true;
        }
        
        if (this.config.debug.enableLogging) {
            console.log('💬 [TWITCH] ❌ Permission denied');
        }
        
        return false;
    }

    handleRollCommand(username) {
        if (this.caseOpening.isOpening) {
            console.log(`🎲 ${username} tried to reroll, but case is already opening`);
            if (this.config.debug.enableLogging) {
                console.log('💬 [TWITCH] Roll command blocked - case already in progress');
            }
            return;
        }
        
        console.log(`🎲 ${username} triggered a reroll`);
        if (this.config.debug.enableLogging) {
            console.log('💬 [TWITCH] Executing roll command...');
        }
        
        // Force new roll even if winner exists
        if (this.caseOpening.winnerPersistence && this.config.persistence.allowRollCommand) {
            this.caseOpening.winnerPersistence.forceNewRoll();
        }
        
        this.caseOpening.rerollCase();
    }

    handleSetCommand(username, emoteName) {
        if (!emoteName) {
            console.log(`❌ ${username} used #set without specifying an emote`);
            if (this.config.debug.enableLogging) {
                console.log('💬 [TWITCH] Set command failed - no emote name provided');
            }
            return;
        }

        if (this.caseOpening.isOpening) {
            console.log(`🎯 ${username} tried to set ${emoteName}, but case is already opening`);
            if (this.config.debug.enableLogging) {
                console.log('💬 [TWITCH] Set command blocked - case already in progress');
            }
            return;
        }

        if (this.config.debug.enableLogging) {
            console.log('💬 [TWITCH] Searching for emote:', emoteName);
            console.log('💬 [TWITCH] Available emotes:', this.caseOpening.emotes.map(e => e.name));
        }

        // Check if emote is valid (exists in target emotes)
        const validEmote = this.caseOpening.emotes.find(emote => 
            emote.name.toLowerCase() === emoteName.toLowerCase()
        );

        if (!validEmote) {
            console.log(`❌ ${username} tried to set invalid emote: ${emoteName}`);
            if (this.config.debug.enableLogging) {
                console.log('💬 [TWITCH] Emote not found in valid emote list');
            }
            return;
        }

        console.log(`🎯 ${username} set winning emote to: ${emoteName}`);
        if (this.config.debug.enableLogging) {
            console.log('💬 [TWITCH] Valid emote found:', validEmote.name, '- executing set command...');
        }
        this.caseOpening.rollWithSetEmote(validEmote);
    }

    updateConnectionStatus(status) {
        // Status display disabled - user requested removal of chat status indicator
        return;
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.connected = false;
            this.updateConnectionStatus('Disconnected');
        }
    }
}

// ===== TWITCH OAUTH AUTHENTICATION =====
class TwitchOAuthManager {
    constructor(config) {
        this.config = config;
        this.clientId = config.twitch.oauth.clientId;
        this.accessToken = config.twitch.oauth.accessToken;
        this.redirectUri = "http://localhost:5173";
    }

    // Check if we have a valid access token
    hasValidToken() {
        return !!(this.clientId && this.accessToken);
    }

    // Generate Twitch OAuth URL
    getAuthUrl() {
        const scopes = this.config.twitch.oauth.scopes.join(' ');
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'token',
            scope: scopes
        });
        
        return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
    }

    // Extract token from URL hash (after redirect)
    extractTokenFromUrl() {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        return params.get('access_token');
    }

    // Validate token with Twitch API
    async validateToken(token = this.accessToken) {
        if (!token) return false;

        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `OAuth ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('🔑 [OAUTH] Token validated:', data);
                return data;
            } else {
                console.error('🔑 [OAUTH] Token validation failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('🔑 [OAUTH] Error validating token:', error);
            return false;
        }
    }

    // Get user info to verify channel ID
    async getUserInfo(token = this.accessToken) {
        if (!token) return null;

        try {
            const response = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Client-Id': this.clientId
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.data[0];
            }
        } catch (error) {
            console.error('🔑 [OAUTH] Error getting user info:', error);
        }
        return null;
    }

    // Start OAuth flow
    startAuthFlow(copyToClipboard = false) {
        if (!this.clientId) {
            console.error('🔑 [OAUTH] No client ID configured');
            alert('Please configure your Twitch Client ID in config.json');
            return;
        }

        const authUrl = this.getAuthUrl();
        
        if (copyToClipboard) {
            // Try to copy to clipboard with fallback
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(authUrl).then(() => {
                    console.log('🔑 [OAUTH] Auth URL copied to clipboard!');
                    console.log('🔑 [OAUTH] URL:', authUrl);
                    alert('Auth URL copied to clipboard! Paste it in your browser.');
                }).catch(err => {
                    console.error('🔑 [OAUTH] Failed to copy to clipboard:', err);
                    console.log('🔑 [OAUTH] Auth URL:', authUrl);
                    // Fallback: show prompt with URL
                    this.showUrlPrompt(authUrl);
                });
            } else {
                // Clipboard API not available, use fallback
                console.log('🔑 [OAUTH] Clipboard API not available, showing URL in prompt');
                console.log('🔑 [OAUTH] Auth URL:', authUrl);
                this.showUrlPrompt(authUrl);
            }
        } else {
            // Open in new window as before
            console.log('🔑 [OAUTH] Starting auth flow:', authUrl);
            window.open(authUrl, 'twitch-auth', 'width=500,height=700');
        }
    }

    // Show URL in a prompt for manual copying
    showUrlPrompt(url) {
        const message = 'Copy this URL and paste it in your browser:\n\n' + url;
        prompt(message, url);
    }

    // Handle OAuth callback
    async handleCallback() {
        const token = this.extractTokenFromUrl();
        if (token) {
            console.log('🔑 [OAUTH] Token received from callback');
            
            // Validate the token
            const validation = await this.validateToken(token);
            if (validation) {
                // Get user info to verify channel
                const userInfo = await this.getUserInfo(token);
                if (userInfo) {
                    console.log('🔑 [OAUTH] Authentication successful:', userInfo);
                    
                    // Update config with token (you'll need to save this manually)
                    this.accessToken = token;
                    
                    console.log('🔑 [OAUTH] IMPORTANT: Add this to your config.json:');
                    console.log(`"accessToken": "${token}"`);
                    console.log(`"channelID": "${userInfo.id}"`);
                    
                    // Clear the URL hash
                    window.location.hash = '';
                    
                    return { token, userInfo };
                }
            }
        }
        return null;
    }
}

// ===== TWITCH CHANNEL POINTS INTEGRATION (EventSub WebSocket) =====
class TwitchEventSubManager {
    constructor(config, caseOpening) {
        this.config = config;
        this.caseOpening = caseOpening;
        this.socket = null;
        this.connected = false;
        this.sessionId = null;
        this.oauthManager = new TwitchOAuthManager(config);
        
        if (this.config.debug.enableLogging) {
            console.log('🎁 [CHANNEL POINTS] Initializing Twitch Channel Points Manager');
            console.log('🎁 [CHANNEL POINTS] Enabled:', this.config.twitch.channelPoints.enabled);
            console.log('🎁 [CHANNEL POINTS] Listen to all rewards:', this.config.twitch.channelPoints.listenToAllRewards);
            console.log('🎁 [CHANNEL POINTS] Specific reward ID:', this.config.twitch.channelPoints.specificRewardId || 'Not set');
        }

        // Don't auto-initialize here - let the main flow control initialization timing
        if (!this.config.twitch.channelPoints.enabled) {
            console.log('🎁 [EVENTSUB] Channel points disabled in config');
        }
        
        // Add manual trigger for testing
        window.testChannelPointRedeem = (rewardTitle = 'CAT OF THE DAY', rewardId = this.config.twitch.channelPoints.specificRewardId) => {
            if (this.config.debug.enableLogging) {
                console.log('🎁 [EVENTSUB] Manual test redemption triggered');
                console.log(`🧪 [TEST] Simulating reward: "${rewardTitle}" with ID: ${rewardId}`);
            }
            this.handleChannelPointRedeem({
                event: {
                    reward: { id: rewardId, title: rewardTitle, cost: 500 },
                    user_name: 'TestUser',
                    user_login: 'testuser'
                }
            });
        };

        // Simple test function that always works
        window.testRoll = () => {
            console.log('🎲 [TEST] Manual roll test triggered');
            this.handleChannelPointRedeem({
                event: {
                    reward: { 
                        id: this.config.twitch.channelPoints.specificRewardId, 
                        title: 'CAT OF THE DAY', 
                        cost: 500 
                    },
                    user_name: 'TestUser',
                    user_login: 'testuser'
                }
            });
        };
    }

    async initializeWithAuth() {
        console.log('🎁 [EVENTSUB] Initializing with OAuth...');
        
        // Check for OAuth callback first
        if (window.location.hash.includes('access_token')) {
            console.log('🔑 [OAUTH] Processing callback...');
            const result = await this.oauthManager.handleCallback();
            if (result) {
                console.log('🔑 [OAUTH] Please update your config with the token shown above, then reload');
                return false;
            }
        }
        
        // Check if we have valid credentials
        if (!this.oauthManager.hasValidToken()) {
            console.log('🔑 [OAUTH] No valid token found');
            this.showAuthInstructions();
            return false;
        }
        
        // Validate the token
        const validation = await this.oauthManager.validateToken();
        if (!validation) {
            console.log('🔑 [OAUTH] Token validation failed');
            this.showTokenValidationError();
            return false;
        }
        
        // Verify the token's user_id matches the configured channel ID
        if (validation.user_id !== this.config.emotes.channelID) {
            console.error('🔑 [OAUTH] Token user ID mismatch!');
            console.error(`🔑 [OAUTH] Token is for user ID: ${validation.user_id}`);
            console.error(`🔑 [OAUTH] Config channel ID: ${this.config.emotes.channelID}`);
            this.showUserIdMismatchError(validation.user_id, this.config.emotes.channelID);
            return false;
        }
        
        // Verify the token has the required scope
        if (!validation.scopes || !validation.scopes.includes('channel:read:redemptions')) {
            console.error('🔑 [OAUTH] Token missing required scope: channel:read:redemptions');
            console.error('🔑 [OAUTH] Token scopes:', validation.scopes);
            this.showMissingScopeError(validation.scopes);
            return false;
        }
        
        console.log('🎁 [EVENTSUB] OAuth authenticated, starting EventSub connection...');
        this.connect();
        return true;
    }

    showTokenValidationError() {
        console.error('🔑 [OAUTH] Token validation failed');
        console.log('🔑 [OAUTH] =================================');
        console.log('🔑 [OAUTH] TOKEN VALIDATION FAILED');
        console.log('🔑 [OAUTH] =================================');
        console.log('🔑 [OAUTH] Your access token is invalid or expired.');
        console.log('🔑 [OAUTH] Please generate a new token using startTwitchAuth()');
        console.log('🔑 [OAUTH] =================================');
        
        // Display error in UI
        if (this.caseOpening) {
            this.caseOpening.showTokenValidationError();
        }
        
        // Add global function for easy access
        window.startTwitchAuth = (copyToClipboard = false) => {
            if (!this.config.twitch.oauth.clientId) {
                alert('Please add your Twitch Client ID to config.json first!\n\nGet one at: https://dev.twitch.tv/console/apps');
                return;
            }
            this.oauthManager.startAuthFlow(copyToClipboard);
        };
    }

    showAuthInstructions() {
        console.log('🔑 [OAUTH] =================================');
        console.log('🔑 [OAUTH] EVENTSUB AUTHENTICATION REQUIRED');
        console.log('🔑 [OAUTH] =================================');
        console.log('🔑 [OAUTH] To use EventSub channel points, you need:');
        console.log('🔑 [OAUTH] 1. A Twitch Client ID');
        console.log('🔑 [OAUTH] 2. An OAuth access token with channel:read:redemptions scope');
        console.log('🔑 [OAUTH] ');
        console.log('🔑 [OAUTH] Run: startTwitchAuth() or startTwitchAuth(true) to copy URL');
        console.log('🔑 [OAUTH] =================================');
        
        // Add global function for easy access
        window.startTwitchAuth = (copyToClipboard = false) => {
            if (!this.config.twitch.oauth.clientId) {
                alert('Please add your Twitch Client ID to config.json first!\n\nGet one at: https://dev.twitch.tv/console/apps');
                return;
            }
            this.oauthManager.startAuthFlow(copyToClipboard);
        };
    }

    showUserIdMismatchError(tokenUserId, configChannelId) {
        console.error('🔑 [OAUTH] =================================');
        console.error('🔑 [OAUTH] USER ID MISMATCH ERROR');
        console.error('🔑 [OAUTH] =================================');
        console.error('🔑 [OAUTH] The access token does NOT belong to the configured channel!');
        console.error('🔑 [OAUTH] ');
        console.error(`🔑 [OAUTH] Token User ID:     ${tokenUserId}`);
        console.error(`🔑 [OAUTH] Config Channel ID: ${configChannelId}`);
        console.error('🔑 [OAUTH] ');
        console.error('🔑 [OAUTH] The token MUST be generated by the broadcaster themselves.');
        console.error('🔑 [OAUTH] Please use startTwitchAuth() while logged in as the broadcaster.');
        console.error('🔑 [OAUTH] =================================');
        
        // Display error in UI
        if (this.caseOpening) {
            this.caseOpening.showErrorMessage(
                'USER ID MISMATCH',
                `Token is for user ${tokenUserId}, but config has channel ${configChannelId}. The broadcaster must generate their own token.`
            );
        }
        
        // Add global function for easy access
        window.startTwitchAuth = (copyToClipboard = false) => {
            if (!this.config.twitch.oauth.clientId) {
                alert('Please add your Twitch Client ID to config.json first!\n\nGet one at: https://dev.twitch.tv/console/apps');
                return;
            }
            this.oauthManager.startAuthFlow(copyToClipboard);
        };
    }

    showMissingScopeError(actualScopes) {
        console.error('🔑 [OAUTH] =================================');
        console.error('🔑 [OAUTH] MISSING REQUIRED SCOPE');
        console.error('🔑 [OAUTH] =================================');
        console.error('🔑 [OAUTH] Required scope: channel:read:redemptions');
        console.error('🔑 [OAUTH] Actual scopes:', actualScopes || 'none');
        console.error('🔑 [OAUTH] ');
        console.error('🔑 [OAUTH] Please generate a new token with the correct scope.');
        console.error('🔑 [OAUTH] =================================');
        
        // Display error in UI
        if (this.caseOpening) {
            this.caseOpening.showErrorMessage(
                'MISSING SCOPE',
                'Token lacks channel:read:redemptions scope. Please generate a new token using startTwitchAuth()'
            );
        }
        
        // Add global function for easy access
        window.startTwitchAuth = (copyToClipboard = false) => {
            if (!this.config.twitch.oauth.clientId) {
                alert('Please add your Twitch Client ID to config.json first!\n\nGet one at: https://dev.twitch.tv/console/apps');
                return;
            }
            this.oauthManager.startAuthFlow(copyToClipboard);
        };
    }

    connect() {
        try {
            console.log('🎁 [EVENTSUB] Attempting to connect to Twitch EventSub WebSocket...');
            
            // Connect to Twitch EventSub WebSocket
            this.socket = new WebSocket('wss://eventsub.wss.twitch.tv/ws');
            
            this.socket.onopen = () => {
                console.log('🔗 Connected to Twitch EventSub WebSocket');
                this.connected = true;
                console.log('🎁 [EVENTSUB] EventSub WebSocket connection established');
                console.log('🎁 [EVENTSUB] Waiting for session welcome message...');
            };

            this.socket.onmessage = (event) => {
                if (this.config.debug.enableLogging) {
                    console.log('🎁 [EVENTSUB] Raw message received:', event.data);
                }
                this.handleMessage(event.data);
            };

            this.socket.onclose = () => {
                console.log('❌ Disconnected from Twitch EventSub');
                this.connected = false;
                this.sessionId = null;
                
                // Show error in UI
                if (this.caseOpening) {
                    this.caseOpening.showErrorMessage('WEBSOCKET DISCONNECTED', 'Connection to Twitch EventSub lost. Attempting to reconnect...');
                }
                
                // Attempt to reconnect after 5 seconds
                setTimeout(() => {
                    console.log('🔄 Attempting to reconnect to Twitch EventSub...');
                    this.connect();
                }, 5000);
            };

            this.socket.onerror = (error) => {
                console.error('🎁 [EVENTSUB] Connection error:', error);
                // Show error in UI
                if (this.caseOpening) {
                    this.caseOpening.showErrorMessage('CONNECTION ERROR', 'Failed to connect to Twitch EventSub WebSocket.');
                }
            };

        } catch (error) {
            console.error('🎁 [EVENTSUB] Failed to connect:', error);
        }
    }

    async subscribeToChannelPoints() {
        if (!this.sessionId) {
            console.error('🎁 [EVENTSUB] Cannot subscribe - no session ID');
            return;
        }

        const channelId = this.config.emotes.channelID;
        if (!channelId) {
            console.error('🎁 [EVENTSUB] No channel ID configured');
            // Show error in UI
            if (this.caseOpening) {
                this.caseOpening.showErrorMessage('MISSING CHANNEL ID', 'Channel ID not configured in config.json. EventSub cannot subscribe.');
            }
            return;
        }

        try {
            console.log('🎁 [EVENTSUB] Creating EventSub subscription for channel point redemptions...');
            
            const subscriptionData = {
                type: 'channel.channel_points_custom_reward_redemption.add',
                version: '1',
                condition: {
                    broadcaster_user_id: channelId
                },
                transport: {
                    method: 'websocket',
                    session_id: this.sessionId
                }
            };

            const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.twitch.oauth.accessToken}`,
                    'Client-Id': this.config.twitch.oauth.clientId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(subscriptionData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('🎁 [EVENTSUB] ✅ Successfully subscribed to channel point redemptions:', result);
            } else {
                const error = await response.json();
                console.error('🎁 [EVENTSUB] ❌ Failed to subscribe:', error);
                // Show error in UI
                if (this.caseOpening) {
                    this.caseOpening.showErrorMessage('SUBSCRIPTION FAILED', 'Failed to subscribe to channel point events. Check your token permissions.');
                }
            }
        } catch (error) {
            console.error('🎁 [EVENTSUB] Error creating subscription:', error);
            // Show error in UI
            if (this.caseOpening) {
                this.caseOpening.showErrorMessage('CONNECTION ERROR', 'Failed to create EventSub subscription. Check console for details.');
            }
        }
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log('🎁 [EVENTSUB] Parsed message:', message);
            
            // Handle session welcome message
            if (message.metadata && message.metadata.message_type === 'session_welcome') {
                this.sessionId = message.payload.session.id;
                console.log('🎁 [EVENTSUB] ✅ Session established with ID:', this.sessionId);
                console.log('🎁 [EVENTSUB] Creating channel point redemption subscription...');
                this.subscribeToChannelPoints();
                return;
            }
            
            // Handle session keepalive
            if (message.metadata && message.metadata.message_type === 'session_keepalive') {
                if (this.config.debug.enableLogging) {
                    console.log('🎁 [EVENTSUB] ❤️ Keepalive received');
                }
                return;
            }
            
            // Handle notification (actual events)
            if (message.metadata && message.metadata.message_type === 'notification') {
                if (this.config.debug.enableLogging) {
                    console.log('🎁 [EVENTSUB] 🔔 Notification received:', message.metadata.subscription_type);
                }
                
                if (message.metadata.subscription_type === 'channel.channel_points_custom_reward_redemption.add') {
                    console.log('🎁 [EVENTSUB] 🎯 Channel point redemption detected!');
                    this.handleChannelPointRedeem(message.payload);
                }
                return;
            }
            
            console.log('🎁 [EVENTSUB] Unknown message type:', message.metadata?.message_type || 'no metadata');
            
        } catch (error) {
            console.error('🎁 [EVENTSUB] Error parsing message:', error);
        }
    }

    handleChannelPointRedeem(payload) {
        const event = payload.event;
        const reward = event.reward;
        const userName = event.user_name;
        
        // ===== REWARD ID LOGGING (DEBUG ONLY) =====
        if (this.config.debug.enableLogging) {
            console.log('🆔🎁🆔🎁🆔🎁🆔🎁🆔🎁🆔🎁🆔🎁🆔');
            console.log(`🎁 [EVENTSUB] REWARD ID: ${reward.id}`);
            console.log(`🎁 [EVENTSUB] REWARD NAME: "${reward.title}"`);
            console.log(`🎁 [EVENTSUB] USER: ${userName}`);
            console.log(`🎁 [EVENTSUB] COST: ${reward.cost} points`);
            console.log('🆔🎁🆔🎁🆔🎁🆔🎁🆔🎁🆔🎁🆔🎁🆔');
        }
        
        if (this.config.debug.enableLogging) {
            console.log('🎁 [EVENTSUB] Full reward data:', {
                user: userName,
                reward: reward.title,
                id: reward.id,
                cost: reward.cost,
                fullEvent: event
            });
        }

        // Check if this is the reward we're looking for
        let shouldTrigger = false;
        
        if (this.config.debug.enableLogging) {
            console.log('🎁 [EVENTSUB] Checking trigger conditions:', {
                listenToAll: this.config.twitch.channelPoints.listenToAllRewards,
                specificRewardId: this.config.twitch.channelPoints.specificRewardId,
                rewardTitle: this.config.twitch.channelPoints.rewardTitle,
                actualRewardTitle: reward.title,
                actualRewardId: reward.id
            });
        }
        
        if (this.config.twitch.channelPoints.listenToAllRewards) {
            // Trigger on any channel point redemption
            shouldTrigger = true;
            console.log('🎁 [EVENTSUB] Triggering: Listen to all rewards is enabled');
        } else if (this.config.twitch.channelPoints.specificRewardId) {
            // Only trigger on specific reward ID
            shouldTrigger = reward.id === this.config.twitch.channelPoints.specificRewardId;
            if (this.config.debug.enableLogging) {
                console.log(`🎁 [EVENTSUB] Specific ID check: ${reward.id} === ${this.config.twitch.channelPoints.specificRewardId} = ${shouldTrigger}`);
            }
        } else {
            // Trigger on reward title match
            const hassCat = reward.title.toLowerCase().includes('cat');
            const hasRoll = reward.title.toLowerCase().includes('roll');
            const matchesTitle = reward.title.toLowerCase() === this.config.twitch.channelPoints.rewardTitle.toLowerCase();
            shouldTrigger = hassCat || hasRoll || matchesTitle;
            
            console.log('🎁 [EVENTSUB] Title matching:', {
                rewardTitle: reward.title,
                hasCat: hassCat,
                hasRoll: hasRoll,
                matchesConfigTitle: matchesTitle,
                configTitle: this.config.twitch.channelPoints.rewardTitle,
                willTrigger: shouldTrigger
            });
        }

        if (shouldTrigger) {
            console.log(`🎁 [EVENTSUB] ${userName} redeemed "${reward.title}" - triggering case roll!`);
            
            // Trigger the case roll
            if (this.caseOpening.winnerPersistence && this.config.persistence.allowRollCommand) {
                this.caseOpening.winnerPersistence.forceNewRoll();
            } else {
                // Direct roll if no persistence or command not allowed
                setTimeout(() => this.caseOpening.openCase(), 500);
            }
        } else {
            if (this.config.debug.enableLogging) {
                console.log(`🎁 [EVENTSUB] ❌ Reward "${reward.title}" (ID: ${reward.id}) doesn't match trigger criteria - NOT triggering roll`);
            }
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.connected = false;
        }
    }
}

// ===== MAIN APPLICATION =====
class CaseOpening {
    constructor() {
        this.configManager = new ConfigManager();
        this.config = null;
        this.sevenTVAPI = null;
        this.audioManager = null;
        this.twitchChat = null;
        this.twitchEventSub = null;
        this.winnerPersistence = null;
        this.winnerHistory = null;
        this.gistBackup = null;
        this.healthCheck = null;
        this.emotes = [];
        this.isOpening = false;
        this.rollerTrack = null;
        this.timeUpdateInterval = null;
        
        this.init();
    }

    async init() {
        try {
            // Load configuration first
            this.config = await this.configManager.loadConfig();
            
            // Only show init messages if debug is enabled
            if (this.config.debug.enableLogging) {
                console.log('🚀 [INIT] Starting case opening system initialization...');
                console.log('✅ [INIT] Configuration loaded: Debug ON');
            }
            
            this.sevenTVAPI = new SevenTVAPI(this.config);
            this.audioManager = new AudioManager(this.config);
            
            // Initialize winner persistence system
            if (this.config.debug.enableLogging) {
                console.log('🔍 [DEBUG] Checking persistence config:', {
                    persistenceExists: !!this.config.persistence,
                    enableWinnerMemory: this.config.persistence ? this.config.persistence.enableWinnerMemory : 'N/A'
                });
            }
            
            if (this.config.persistence && this.config.persistence.enableWinnerMemory) {
                this.winnerPersistence = new WinnerPersistence(this.config, this);
                if (this.config.debug.enableLogging) {
                    console.log('💾 [PERSISTENCE] Winner memory system enabled');
                }
            } else {
                if (this.config.debug.enableLogging) {
                    console.log('❌ [PERSISTENCE] Winner memory system disabled or not configured');
                }
            }
            
            // Initialize winner history tracker
            this.winnerHistory = new WinnerHistoryManager(this.config);
            if (this.config.debug.enableLogging) {
                console.log('📊 [HISTORY] Winner history tracker initialized');
                const stats = this.winnerHistory.getStatistics();
                console.log('📊 [HISTORY] Total historical rolls:', stats.totalRolls);
            }
            
            // Add global functions for history management
            window.exportWinnerHistory = () => this.winnerHistory.exportHistory();
            window.getWinnerStats = () => {
                const stats = this.winnerHistory.getStatistics();
                console.log('📊 WINNER STATISTICS:');
                console.log('Total Rolls:', stats.totalRolls);
                console.log('\nBy Rarity:');
                Object.entries(stats.byRarity).forEach(([rarity, count]) => {
                    const percentage = stats.totalRolls > 0 ? ((count / stats.totalRolls) * 100).toFixed(1) : 0;
                    console.log(`  ${rarity}: ${count} (${percentage}%)`);
                });
                console.log('\nMost Common Emotes:');
                const topEmotes = Object.entries(stats.byEmote)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 10);
                topEmotes.forEach(([name, data], i) => {
                    console.log(`  ${i + 1}. ${name}: ${data.count} times (${data.rarity})`);
                });
                return stats;
            };
            window.clearWinnerHistory = () => {
                if (confirm('Are you sure you want to clear all winner history?')) {
                    this.winnerHistory.clearHistory();
                    console.log('✅ History cleared');
                }
            };
            
            // Initialize GitHub Gist backup manager
            this.gistBackup = new GistBackupManager(this.config, this.winnerHistory);
            if (this.gistBackup.enabled) {
                if (this.config.debug.enableLogging) {
                    console.log('☁️ [BACKUP] Gist backup manager initialized and enabled');
                }
            } else {
                if (this.config.debug.enableLogging) {
                    console.log('☁️ [BACKUP] Gist backup manager initialized but disabled (no token)');
                }
            }
            
            // Add global functions for backup management (only if enabled)
            if (this.gistBackup.enabled) {
                window.syncToGist = async () => {
                    console.log('☁️ [GIST] Starting manual backup...');
                    const result = await this.gistBackup.syncToGist();
                    if (result.success) {
                        console.log('✅ Backup complete! URL:', result.url);
                    } else {
                        console.error('❌ Backup failed:', result.error);
                    }
                    return result;
                };
                
                window.restoreFromGist = async (gistId) => {
                    if (!gistId) {
                        console.error('Usage: restoreFromGist("your_gist_id")');
                        return;
                    }
                    console.log('☁️ [GIST] Starting restore...');
                    const result = await this.gistBackup.restoreFromGist(gistId);
                    if (result.success) {
                        console.log('✅ Restore complete! Entries restored:', result.entriesRestored);
                        console.log('🔄 Reload the page to see the restored data');
                    } else {
                        console.error('❌ Restore failed:', result.error);
                    }
                    return result;
                };
                
                window.getBackupInfo = () => this.gistBackup.getBackupInfo();
            }
            
            // Initialize health check manager
            this.healthCheck = new HealthCheckManager(this);
            if (this.config.debug.enableLogging) {
                console.log('🏥 [HEALTH] Health check manager initialized');
            }
            
            // Add global function for health check
            window.runHealthCheck = async () => {
                return await this.healthCheck.runHealthCheck();
            };
            
            // Print available console commands
            console.log('%c🐱 Cat of the Day - Available Commands', 'font-size: 14px; font-weight: bold; color: #00aaff;');
            console.log('%cHistory:', 'font-weight: bold; color: #00ff00;');
            console.log('  • getWinnerStats() - View winner statistics');
            console.log('  • exportWinnerHistory() - Download history as JSON');
            console.log('  • clearWinnerHistory() - Clear all history');
            
            // Only show backup commands if enabled
            if (this.gistBackup.enabled) {
                console.log('%cBackup:', 'font-weight: bold; color: #ffd700;');
                console.log('  • syncToGist() - Backup to GitHub Gist');
                console.log('  • restoreFromGist("gist_id") - Restore from Gist');
                console.log('  • getBackupInfo() - Check backup status');
            }
            
            console.log('%cSystem:', 'font-weight: bold; color: #ff6600;');
            console.log('  • runHealthCheck() - Run system diagnostics');
            console.log('  • testRoll() - Trigger test roll');
            console.log('  • startTwitchAuth() - Open OAuth URL in new window');
            console.log('  • startTwitchAuth(true) - Copy OAuth URL to clipboard');
            console.log('%c ', 'font-size: 1px;'); // Add spacing
            
            // Test debug message to confirm console is working
            if (this.config.debug.enableLogging) {
                console.log('🔧 [DEBUG] System initialized with debug logging enabled');
            }
            
            // Initialize Twitch chat manager
            this.twitchChat = new TwitchChatManager(this.config, this);
            
            // Initialize Twitch EventSub manager for channel points (but don't initialize yet)
            this.twitchEventSub = new TwitchEventSubManager(this.config, this);
            
            // Show channel header if enabled
            this.setupChannelHeader();
            
            // Show loading
            this.showLoading();
            
            // Fetch emotes from 7TV API
            if (this.config.debug.enableLogging) {
                console.log('🚀 Starting emote fetch...');
            }
            this.emotes = await this.sevenTVAPI.fetchEmotes();
            
            // If no emotes fetched, force fallback
            if (!this.emotes || this.emotes.length === 0) {
                if (this.config.debug.enableLogging) {
                    console.log('⚠️ No emotes from API, forcing fallback');
                }
                this.emotes = this.sevenTVAPI.getFallbackEmotes();
            }
            
            if (this.config.debug.enableLogging) {
                console.log(`\n🎯 FINAL EMOTE LIST (${this.emotes.length} total):`);
                this.emotes.forEach((emote, index) => {
                    console.log(`${index + 1}. ${emote.name} (${emote.rarity})`);
                });
                console.log(`\n`);
            }
            
            // Hide loading and start the demo
            this.hideLoading();
            
            // Check if we have emotes before generating roller
            if (!this.emotes || this.emotes.length === 0) {
                console.error('❌ No emotes loaded, showing error');
                this.showError();
                return;
            }
            
            this.generateRollerItems();
            
            // Check for existing winner or auto-start
            if (this.config.debug.enableLogging) {
                console.log('🔍 [DEBUG] Initialization flow check:', {
                    hasWinnerPersistence: !!this.winnerPersistence,
                    persistenceEnabled: this.config.persistence ? this.config.persistence.enableWinnerMemory : false,
                    autoStart: this.config.animation.autoStart
                });
            }
            if (this.winnerPersistence && this.config.persistence.enableWinnerMemory) {
                if (this.config.debug.enableLogging) {
                    console.log('🎯 [PERSISTENCE] Using persistence flow');
                }
                const existingWinner = this.winnerPersistence.getCurrentWinner();
                
                if (existingWinner && !this.winnerPersistence.isWinnerExpired()) {
                    // Show existing winner
                    if (this.config.debug.enableLogging) {
                        console.log('👑 [PERSISTENCE] Showing existing winner:', existingWinner.emote.name);
                    }
                    this.showExistingWinner(existingWinner.emote);
                    this.startTimeUpdateDisplay();
                } else {
                    // No valid winner, check if channel points are configured before showing waiting screen
                    if (this.config.twitch.channelPoints.enabled) {
                        // Attempt to initialize EventSub
                        const eventSubReady = await this.twitchEventSub.initializeWithAuth();
                        if (eventSubReady) {
                            // EventSub is ready, show waiting screen
                            if (this.config.debug.enableLogging) {
                                console.log('🎯 [PERSISTENCE] No valid winner found - waiting for channel point redemption');
                            }
                            this.showWaitingForRedemption();
                        }
                        // If eventSubReady is false, the error screen is already shown by initializeWithAuth
                    } else {
                        // No channel points, check auto-start
                        if (this.config.animation.autoStart) {
                            if (this.config.debug.enableLogging) {
                                console.log(`🔄 [AUTO-START] Auto-start enabled - case will open in ${this.config.animation.autoStartDelay}ms`);
                            }
                            setTimeout(() => {
                                if (this.config.debug.enableLogging) {
                                    console.log('🎯 [AUTO-START] Auto-starting case opening...');
                                }
                                this.openCase();
                            }, this.config.animation.autoStartDelay);
                        } else {
                            if (this.config.debug.enableLogging) {
                                console.log('⏸️ [AUTO-START] Auto-start disabled - showing waiting screen');
                            }
                            this.showWaitingForRedemption();
                        }
                    }
                }
            } else {
                // Persistence disabled - check if channel points are enabled
                if (this.config.twitch.channelPoints.enabled) {
                    // Attempt to initialize EventSub first
                    const eventSubReady = await this.twitchEventSub.initializeWithAuth();
                    if (eventSubReady) {
                        // Channel points enabled and ready, show waiting screen
                        if (this.config.debug.enableLogging) {
                            console.log('🎯 [CHANNEL POINTS] Persistence disabled but channel points enabled - showing waiting screen');
                        }
                        this.showWaitingForRedemption();
                    }
                    // If eventSubReady is false, the error screen is already shown by initializeWithAuth
                } else if (this.config.animation.autoStart) {
                    // No channel points, use auto-start if enabled
                    if (this.config.debug.enableLogging) {
                        console.log(`🔄 [AUTO-START] Auto-start enabled - case will open in ${this.config.animation.autoStartDelay}ms`);
                    }
                    setTimeout(() => {
                        if (this.config.debug.enableLogging) {
                            console.log('🎯 [AUTO-START] Auto-starting case opening...');
                        }
                        this.openCase();
                    }, this.config.animation.autoStartDelay);
                } else {
                    // Nothing configured, show waiting screen as fallback
                    if (this.config.debug.enableLogging) {
                        console.log('⏸️ [AUTO-START] Auto-start disabled - showing waiting screen');
                    }
                    this.showWaitingForRedemption();
                }
            }
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.hideLoading();
            this.showError();
        }
    }

    setupChannelHeader() {
        if (this.config.channel.displayChannelName && this.config.channel.name !== "YourChannelName") {
            const header = document.createElement('div');
            header.className = 'channel-header visible';
            const channelName = document.createElement('div');
            channelName.className = 'channel-name';
            channelName.textContent = this.config.channel.name;
            header.appendChild(channelName);
            document.body.appendChild(header);
        }
    }

    showLoading() {
        const caseContainer = document.querySelector('.case-container');
        this.replaceChildren(caseContainer, this.createLoadingContainer());
    }

    hideLoading() {
        if (this.config.debug.enableLogging) {
            console.log('🔄 Hiding loading and setting up roller...');
        }
        const caseContainer = document.querySelector('.case-container');
        const rollerContainer = this.createRollerContainer();
        this.replaceChildren(caseContainer, rollerContainer);
        this.rollerTrack = rollerContainer.querySelector('#rollerTrack');
        if (this.config.debug.enableLogging) {
            console.log('Roller track element:', this.rollerTrack ? '✅ Found' : '❌ Not found');
        }
    }

    showError() {
        // Backward compatibility - calls new error system
        this.showErrorMessage('EMOTE LOAD FAILED', 'Failed to load emotes. Using fallback emotes.', true);
    }

    generateRollerItems() {
        if (this.config.debug.enableLogging) {
            console.log('🎲 Generating roller items...');
            console.log('Available emotes for roller:', this.emotes.length);
        }
        
        if (!this.emotes || this.emotes.length === 0) {
            console.error('❌ No emotes available for roller!');
            return;
        }
        
        if (!this.rollerTrack) {
            console.error('❌ Roller track not found!');
            return;
        }
        
        // Generate 100 items for the roller (preventing adjacent duplicates)
        const items = [];
        let lastEmote = null;
        
        for (let i = 0; i < 100; i++) {
            let randomEmote;
            let attempts = 0;
            
            // Try to get a different emote than the last one (max 10 attempts to avoid infinite loop)
            do {
                randomEmote = this.emotes[Math.floor(Math.random() * this.emotes.length)];
                attempts++;
            } while (lastEmote && randomEmote.id === lastEmote.id && attempts < 10);
            
            items.push(this.createSafeEmoteTile(randomEmote));
            lastEmote = randomEmote;
        }
        
        if (this.config.debug.enableLogging) {
            console.log('Generated', items.length, 'roller items');
        }
        this.replaceChildren(this.rollerTrack, items);
        if (this.config.debug.enableLogging) {
            console.log('✅ Roller items inserted into DOM, children count:', this.rollerTrack.children.length);
        }
    }

    createEmoteTile(emote) {
        return this.createSafeEmoteTile(emote);
        const showBorder = this.config.display.showRarityBorders ? emote.rarity : '';
        if (this.config.debug.enableLogging) {
            console.log(`Creating tile for ${emote.name} with imageUrl:`, emote.imageUrl);
        }
        
        // Create a visible fallback if image fails
        const fallbackSVG = this.generateFallbackSVG(emote.name, this.getRarityColor(emote.rarity));
        const rarityColor = this.getRarityColor(emote.rarity);
        
        const debugOnLoad = this.config.debug.enableLogging ? `console.log('✅ Image loaded:', '${emote.name}'); this.style.border='2px solid ${rarityColor}';` : `this.style.border='2px solid ${rarityColor}';`;
        const debugOnError = this.config.debug.enableLogging ? `console.log('❌ Image failed:', '${emote.name}', this.src); this.src='${fallbackSVG}'; this.style.border='2px solid red';` : `this.src='${fallbackSVG}'; this.style.border='2px solid red';`;
        
        return `
            <div class="emote-tile ${showBorder}" data-emote-id="${emote.id}" style="min-width: 150px; min-height: 150px;">
                ${glowDiv}
                <img src="${emote.imageUrl}" 
                     alt="${emote.name}" 
                     class="emote-image" 
                     data-legacy-load="${debugOnLoad}"
                     data-legacy-error="${debugOnError}"
                     loading="eager"
                     style="width: 80px; height: 80px; object-fit: contain; display: block; border: 3px solid ${rarityColor}; background: rgba(255,255,255,0.1);">
                <div class="emote-name" style="color: white; font-size: 14px; text-align: center; margin-top: 8px; font-weight: bold;">${emote.name}</div>
            </div>
        `;
    }

    createSafeEmoteTile(emote) {
        const showBorder = this.config.display.showRarityBorders ? emote.rarity : '';

        if (this.config.debug.enableLogging) {
            console.log(`Creating tile for ${emote.name} with imageUrl:`, emote.imageUrl);
        }

        const fallbackSVG = this.generateFallbackSVG(emote.name, this.getRarityColor(emote.rarity));
        const rarityColor = this.getRarityColor(emote.rarity);

        const tile = document.createElement('div');
        tile.className = `emote-tile ${showBorder}`.trim();
        tile.dataset.emoteId = emote.id;
        tile.style.minWidth = '150px';
        tile.style.minHeight = '150px';

        if (this.config.display.showGlowEffects) {
            const glow = document.createElement('div');
            glow.className = 'rarity-glow';
            tile.appendChild(glow);
        }

        const image = document.createElement('img');
        image.src = emote.imageUrl;
        image.alt = emote.name;
        image.className = 'emote-image';
        image.loading = 'eager';
        image.style.width = '80px';
        image.style.height = '80px';
        image.style.objectFit = 'contain';
        image.style.display = 'block';
        image.style.border = `3px solid ${rarityColor}`;
        image.style.background = 'rgba(255,255,255,0.1)';
        image.addEventListener('load', () => {
            if (this.config.debug.enableLogging) {
                console.log('Image loaded:', emote.name);
            }
            image.style.border = `2px solid ${rarityColor}`;
        });
        image.addEventListener('error', () => {
            if (this.config.debug.enableLogging) {
                console.log('Image failed:', emote.name, image.src);
            }
            image.src = fallbackSVG;
            image.style.border = '2px solid red';
        }, { once: true });

        const name = document.createElement('div');
        name.className = 'emote-name';
        name.style.color = 'white';
        name.style.fontSize = '14px';
        name.style.textAlign = 'center';
        name.style.marginTop = '8px';
        name.style.fontWeight = 'bold';
        name.textContent = emote.name;

        tile.appendChild(image);
        tile.appendChild(name);
        return tile;
    }

    generateFallbackSVG(name, color) {
        const svg = `
            <svg width="50" height="50" xmlns="http://www.w3.org/2000/svg">
                <rect width="50" height="50" fill="${color}20" stroke="${color}" stroke-width="2" rx="5"/>
                <text x="25" y="30" text-anchor="middle" fill="${color}" font-family="Arial" font-size="8" font-weight="bold">
                    ${name.slice(0, 6)}
                </text>
            </svg>
        `;
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    getRarityColor(rarity) {
        const colors = this.config.theme.rarityColors;
        return colors[rarity] || colors.common;
    }

    selectRandomEmote() {
        // Use config-defined rarity weights
        const weights = this.config.rarity.weights;
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        for (const [rarity, weight] of Object.entries(weights)) {
            random -= weight;
            if (random <= 0) {
                const emotesOfRarity = this.emotes.filter(e => e.rarity === rarity);
                if (emotesOfRarity.length > 0) {
                    return emotesOfRarity[Math.floor(Math.random() * emotesOfRarity.length)];
                }
            }
        }
        
        return this.emotes[0]; // Fallback
    }

    generateFinalRoller(winningEmote) {
        // Generate items with the winning emote at position 50 (center of view)
        const items = [];
        let lastEmote = null;
        
        for (let i = 0; i < 100; i++) {
            let currentEmote;
            
            if (i === 50) {
                // Place winning emote at center position
                currentEmote = winningEmote;
            } else {
                // Random emotes for other positions (prevent adjacent duplicates)
                let attempts = 0;
                do {
                    currentEmote = this.emotes[Math.floor(Math.random() * this.emotes.length)];
                    attempts++;
                } while (lastEmote && currentEmote.id === lastEmote.id && attempts < 10);
            }
            
            items.push(this.createSafeEmoteTile(currentEmote));
            lastEmote = currentEmote;
        }
        
        this.replaceChildren(this.rollerTrack, items);
    }

    async openCase() {
        if (this.isOpening) return;
        
        this.isOpening = true;
        
        // Ensure roller container exists (might have been replaced by waiting message)
        if (!document.querySelector('.roller-container') || !this.rollerTrack) {
            if (this.config.debug.enableLogging) {
                console.log('🔧 [SETUP] Roller container missing, recreating...');
            }
            this.hideLoading();
            this.generateRollerItems();
        }
        
        // Select the winning emote
        const winningEmote = this.selectRandomEmote();
        if (this.config.debug.enableLogging) {
            console.log('Selected emote:', winningEmote);
        }
        
        // Play rolling sound and start gamba music if enabled
        if (this.config.animation.enableSounds) {
            this.audioManager.playRollSound();
            this.audioManager.startGambaMusic();
        }
        
        // Calculate final position
        const containerWidth = this.rollerTrack.parentElement.offsetWidth;
        const tileWidth = 166; // 150px + 16px margin
        const centerOffset = containerWidth / 2 - 75; // Center the tile
        
        // Generate final roller content with winning emote in the center
        this.generateFinalRoller(winningEmote);
        
        // Calculate transform distance (move left by a large amount, then ease to final position)
        const rollDistance = 50 * tileWidth; // Roll past 50 items
        const finalPosition = rollDistance - centerOffset;
        
        // Animate the roller
        this.rollerTrack.style.transform = `translateX(-${finalPosition}px)`;
        
        // Wait for animation to complete, then highlight the winning emote
        if (this.config.debug.enableLogging) {
            console.log(`🎵 [TIMING] Case opening will complete in ${this.config.animation.rollDuration}ms (${this.config.animation.rollDuration/1000} seconds)`);
        }
        setTimeout(() => {
            if (this.config.debug.enableLogging) {
                console.log('🎵 [TIMING] Case opening animation completed - stopping audio');
            }
            if (this.config.animation.enableSounds) {
                this.audioManager.stopGambaMusic(); // Stop the gamba music
                this.audioManager.playWinSound(winningEmote.rarity);
            }
            this.highlightWinningEmote();
        }, this.config.animation.rollDuration);
    }

    // Reroll with random emote (triggered by #roll command)
    rerollCase() {
        if (this.isOpening) return;
        
        console.log('🎲 Rerolling case...');
        
        // Clear time update interval
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
        
        // Reset the roller state
        this.resetRoller();
        
        // Start a new case opening
        this.openCase();
    }

    // Reset and start new roll (for timer expiration)
    resetAndRoll() {
        if (this.isOpening) return;
        
        console.log('⏰ [PERSISTENCE] Timer expired - starting new roll...');
        
        // Clear time update interval
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
        
        // Reset the roller state
        this.resetRoller();
        
        // Start a new case opening
        this.openCase();
    }

    // Roll with a specific emote guaranteed to win (triggered by #set command)
    rollWithSetEmote(targetEmote) {
        if (this.isOpening) return;
        
        console.log(`🎯 Rolling with set emote: ${targetEmote.name}`);
        
        // Reset the roller state
        this.resetRoller();
        
        // Start case opening with the predetermined winner
        this.openCaseWithSetWinner(targetEmote);
    }

    // Reset roller to initial state
    resetRoller() {
        this.isOpening = false;
        
        // Stop any playing gamba music (only if not currently in an animation)
        if (this.config.animation.enableSounds) {
            this.audioManager.stopGambaMusic();
        }
        
        const caseContainer = document.querySelector('.case-container');
        let rollerContainer = document.querySelector('.roller-container');
        
        // If roller container doesn't exist (after showFinalEmote), recreate it
        if (!rollerContainer) {
            if (this.config.debug.enableLogging) {
                console.log('💬 [TWITCH] Recreating roller HTML structure');
            }
            rollerContainer = this.createRollerContainer();
            this.replaceChildren(caseContainer, rollerContainer);
            this.rollerTrack = rollerContainer.querySelector('#rollerTrack');
            rollerContainer = document.querySelector('.roller-container');
        }
        
        // Show roller container
        if (rollerContainer) {
            rollerContainer.style.display = 'flex';
        }
        
        // Reset roller position
        if (this.rollerTrack) {
            this.rollerTrack.style.transform = 'translateX(0px)';
        }
        
        // Remove any existing final emote displays
        const existingFinalEmote = caseContainer.querySelector('.final-emote-container, .final-emote-no-box');
        if (existingFinalEmote) {
            existingFinalEmote.remove();
        }
        
        // Remove winning classes
        const winningTiles = document.querySelectorAll('.emote-tile.winning-emote');
        winningTiles.forEach(tile => tile.classList.remove('winning-emote'));
        
        const winningWindow = document.querySelector('.selection-window.winning-glow');
        if (winningWindow) {
            winningWindow.classList.remove('winning-glow');
        }
        
        // Regenerate roller items
        this.generateRollerItems();
    }

    // Modified openCase that accepts a predetermined winner
    async openCaseWithSetWinner(predeterminedWinner) {
        if (this.isOpening) return;
        
        this.isOpening = true;
        
        // Use the predetermined winner instead of selecting random
        const winningEmote = predeterminedWinner;
        if (this.config.debug.enableLogging) {
            console.log('Selected predetermined emote:', winningEmote);
        }
        
        // Play rolling sound and start gamba music if enabled
        if (this.config.animation.enableSounds) {
            this.audioManager.playRollSound();
            this.audioManager.startGambaMusic();
        }
        
        // Calculate final position
        const containerWidth = this.rollerTrack.parentElement.offsetWidth;
        const tileWidth = 166; // 150px + 16px margin
        const centerOffset = containerWidth / 2 - 75; // Center the tile
        
        // Generate final roller content with predetermined winning emote in the center
        this.generateFinalRoller(winningEmote);
        
        // Calculate transform distance (move left by a large amount, then ease to final position)
        const rollDistance = 50 * tileWidth; // Roll past 50 items
        const finalPosition = rollDistance - centerOffset;
        
        // Animate the roller
        this.rollerTrack.style.transform = `translateX(-${finalPosition}px)`;
        
        // Wait for animation to complete, then highlight the winning emote
        setTimeout(() => {
            if (this.config.animation.enableSounds) {
                this.audioManager.stopGambaMusic(); // Stop the gamba music
                this.audioManager.playWinSound(winningEmote.rarity);
            }
            this.highlightWinningEmote();
        }, this.config.animation.rollDuration);
    }

    highlightWinningEmote() {
        // Find the winning emote tile (should be at position 50)
        const emoteTiles = this.rollerTrack.querySelectorAll('.emote-tile');
        const winningTile = emoteTiles[50]; // Position 50 is our center position
        
        if (winningTile) {
            // Clone the winning emote data
            const emoteImg = winningTile.querySelector('.emote-image');
            const emoteName = winningTile.querySelector('.emote-name');
            const emoteRarity = winningTile.classList[1]; // Get rarity class
            
            // Hide the entire roller container
            const rollerContainer = document.querySelector('.roller-container');
            if (rollerContainer) {
                rollerContainer.style.display = 'none';
            }
            
            // Create and show the final emote display
            if (emoteImg && emoteName) {
                this.showFinalEmote({
                    imageUrl: emoteImg.src,
                    name: emoteName.textContent,
                    rarity: emoteRarity
                });
            } else {
                console.error('🚨 [ERROR] Could not find emote image or name in winning tile');
            }
        } else {
            console.error('🚨 [ERROR] Could not find winning tile at position 50');
        }
    }

    showFinalEmote(emote) {
        // Mark case opening as completed
        this.isOpening = false;
        
        // Save winner to persistence if enabled
        if (this.winnerPersistence && this.config.persistence.enableWinnerMemory) {
            this.winnerPersistence.saveWinner(emote);
        }
        
        // Always track winner in history
        if (this.winnerHistory) {
            this.winnerHistory.addWinner(emote);
        }
        
        this.displayWinner(emote);
        
        // Start time update display if persistence is enabled
        if (this.winnerPersistence && this.config.persistence.showTimeRemaining) {
            this.startTimeUpdateDisplay();
        }
    }

    showExistingWinner(emote) {
        this.displayWinner(emote);
    }

    showWaitingForRedemption() {
        const waitingContainer = this.createStatusScreen(
            'WAITING FOR REDEMPTION',
            'Redeem "CAT OF THE DAY" with Channel Points'
        );
        const caseContainer = document.querySelector('.case-container');
        this.replaceChildren(caseContainer, waitingContainer);
        
        if (this.config.debug.enableLogging) {
            console.log('💤 [WAITING] Displayed waiting message for channel point redemption');
        }
    }

    showTokenValidationError() {
        this.showErrorMessage(
            'FAILED TOKEN VALIDATION',
            'Your access token is invalid or expired. Please update your token in config.json'
        );
    }

    showErrorMessage(errorTitle, errorMessage, autoRecover = false) {
        const errorContainer = this.createStatusScreen(errorTitle, errorMessage, true);
        const caseContainer = document.querySelector('.case-container');
        if (caseContainer) {
            this.replaceChildren(caseContainer, errorContainer);
        }
        
        if (this.config && this.config.debug.enableLogging) {
            console.error(`❌ [ERROR] ${errorTitle}: ${errorMessage}`);
        }
        
        // Auto-recover if specified
        if (autoRecover) {
            setTimeout(() => {
                if (this.sevenTVAPI) {
                    this.emotes = this.sevenTVAPI.getFallbackEmotes();
                    this.hideLoading();
                    this.generateRollerItems();
                    setTimeout(() => this.openCase(), 500);
                }
            }, 2000);
        }
    }

    displayWinner(emote) {
        const finalEmoteContainer = document.createElement('div');
        finalEmoteContainer.className = 'final-emote-container';
        
        const sizeClass = this.config.display.finalEmoteSize === 'large' ? 'final-emote-image' : 'final-emote-image-small';

        const title = document.createElement('div');
        title.className = emote.rarity === 'legendary' ? 'cat-title legendary' : 'cat-title';
        title.textContent = 'Cat Of The Day';
        finalEmoteContainer.appendChild(title);

        if (this.winnerPersistence && this.config.persistence.showTimeRemaining) {
            const timeRemaining = document.createElement('div');
            timeRemaining.id = 'timeRemaining';
            timeRemaining.className = 'time-remaining';
            timeRemaining.appendChild(document.createTextNode('Next roll available in: '));

            const countdown = document.createElement('span');
            countdown.id = 'countdown';
            countdown.textContent = 'Calculating...';
            timeRemaining.appendChild(countdown);
            finalEmoteContainer.appendChild(timeRemaining);
        }

        const emoteWrapper = document.createElement('div');
        emoteWrapper.className = 'final-emote-no-box';

        const image = document.createElement('img');
        image.src = emote.imageUrl;
        image.alt = emote.name;
        image.className = sizeClass;
        image.crossOrigin = 'anonymous';
        image.addEventListener('error', () => {
            if (this.sevenTVAPI) {
                image.src = this.sevenTVAPI.generatePlaceholderSVG(emote.name, this.getRarityColor(emote.rarity));
            }
        }, { once: true });

        emoteWrapper.appendChild(image);
        finalEmoteContainer.appendChild(emoteWrapper);

        const caseContainer = document.querySelector('.case-container');
        this.replaceChildren(caseContainer, finalEmoteContainer);
    }

    createLoadingContainer() {
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'loading-container';

        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';

        const text = document.createElement('div');
        text.className = 'loading-text';
        text.textContent = 'Loading cat emotes...';

        loadingContainer.appendChild(spinner);
        loadingContainer.appendChild(text);
        return loadingContainer;
    }

    createRollerContainer() {
        const rollerContainer = document.createElement('div');
        rollerContainer.className = 'roller-container';

        const selectionWindow = document.createElement('div');
        selectionWindow.className = 'selection-window';

        const rollerTrack = document.createElement('div');
        rollerTrack.className = 'roller-track';
        rollerTrack.id = 'rollerTrack';

        rollerContainer.appendChild(selectionWindow);
        rollerContainer.appendChild(rollerTrack);
        return rollerContainer;
    }

    createStatusScreen(statusText, instructionText, isError = false) {
        const container = document.createElement('div');
        container.className = 'final-emote-container';

        const title = document.createElement('div');
        title.className = 'cat-title';
        title.textContent = 'Cat Of The Day';

        const message = document.createElement('div');
        message.className = isError ? 'waiting-message error' : 'waiting-message';

        const status = document.createElement('div');
        status.className = isError ? 'waiting-status error' : 'waiting-status';
        status.textContent = statusText;

        const instruction = document.createElement('div');
        instruction.className = 'waiting-instruction';
        instruction.textContent = instructionText;

        message.appendChild(status);
        message.appendChild(instruction);
        container.appendChild(title);
        container.appendChild(message);
        return container;
    }

    replaceChildren(parent, children) {
        if (!parent) return;

        parent.replaceChildren();
        const nodes = Array.isArray(children) ? children : [children];
        const fragment = document.createDocumentFragment();

        nodes.filter(Boolean).forEach(node => fragment.appendChild(node));
        parent.appendChild(fragment);
    }

    startTimeUpdateDisplay() {
        if (!this.winnerPersistence || !this.config.persistence.showTimeRemaining) return;
        
        // Clear existing interval
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
        
        const updateCountdown = () => {
            const countdownElement = document.getElementById('countdown');
            if (!countdownElement) return;
            
            const timeRemaining = this.winnerPersistence.getTimeRemainingFormatted();
            
            if (timeRemaining === "Expired") {
                countdownElement.textContent = "Ready for new roll!";
                countdownElement.style.color = "#00ff00";
                clearInterval(this.timeUpdateInterval);
                
                // Auto-start new roll if enabled
                if (this.config.animation.autoStart) {
                    setTimeout(() => {
                        this.resetAndRoll();
                    }, 2000);
                }
            } else {
                countdownElement.textContent = timeRemaining;
                countdownElement.style.color = "#cccccc";
            }
        };
        
        // Update immediately and then every second
        updateCountdown();
        this.timeUpdateInterval = setInterval(updateCountdown, 1000);
    }
}

// ===== INITIALIZE APPLICATION =====
document.addEventListener('DOMContentLoaded', () => {
    let caseApp;
    try {
        caseApp = new CaseOpening();
        window.caseOpening = caseApp; // Expose globally for testing
    } catch (error) {
        console.error('❌ Error creating CaseOpening instance:', error);
        return;
    }
    

});
