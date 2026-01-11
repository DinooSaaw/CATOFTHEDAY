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
                errorContainer.innerHTML = `
                    <div class="cat-title">Cat Of The Day</div>
                    <div class="waiting-message error">
                        <div class="waiting-status error">CONFIG LOAD FAILED</div>
                        <div class="waiting-instruction">Failed to load config.json. Using default configuration.</div>
                    </div>
                `;
                caseContainer.innerHTML = '';
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
        this.redirectUri = "https://dinoosaaw.com/twitch/fallback";
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
    startAuthFlow() {
        if (!this.clientId) {
            console.error('🔑 [OAUTH] No client ID configured');
            alert('Please configure your Twitch Client ID in config.json');
            return;
        }

        const authUrl = this.getAuthUrl();
        console.log('🔑 [OAUTH] Starting auth flow:', authUrl);
        window.open(authUrl, 'twitch-auth', 'width=500,height=700');
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

        if (this.config.twitch.channelPoints.enabled) {
            this.initializeWithAuth();
        } else {
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
                return;
            }
        }
        
        // Check if we have valid credentials
        if (!this.oauthManager.hasValidToken()) {
            console.log('🔑 [OAUTH] No valid token found');
            this.showAuthInstructions();
            return;
        }
        
        // Validate the token
        const validation = await this.oauthManager.validateToken();
        if (!validation) {
            console.log('🔑 [OAUTH] Token validation failed');
            this.showTokenValidationError();
            return;
        }
        
        console.log('🎁 [EVENTSUB] OAuth authenticated, starting EventSub connection...');
        this.connect();
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
        window.startTwitchAuth = () => {
            if (!this.config.twitch.oauth.clientId) {
                alert('Please add your Twitch Client ID to config.json first!\n\nGet one at: https://dev.twitch.tv/console/apps');
                return;
            }
            this.oauthManager.startAuthFlow();
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
        console.log('🔑 [OAUTH] Run: startTwitchAuth() to begin setup');
        console.log('🔑 [OAUTH] =================================');
        
        // Add global function for easy access
        window.startTwitchAuth = () => {
            if (!this.config.twitch.oauth.clientId) {
                alert('Please add your Twitch Client ID to config.json first!\n\nGet one at: https://dev.twitch.tv/console/apps');
                return;
            }
            this.oauthManager.startAuthFlow();
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
            
            // Test debug message to confirm console is working
            if (this.config.debug.enableLogging) {
                console.log('🔧 [DEBUG] System initialized with debug logging enabled');
            }
            
            // Initialize Twitch chat manager
            this.twitchChat = new TwitchChatManager(this.config, this);
            
            // Initialize Twitch EventSub manager for channel points
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
                    // No valid winner, wait for redemption
                    if (this.config.debug.enableLogging) {
                        console.log('🎯 [PERSISTENCE] No valid winner found - waiting for channel point redemption');
                    }
                    this.showWaitingForRedemption();
                }
            } else {
                // Persistence disabled - check if channel points are enabled
                if (this.config.twitch.channelPoints.enabled) {
                    // Channel points enabled, show waiting screen
                    if (this.config.debug.enableLogging) {
                        console.log('🎯 [CHANNEL POINTS] Persistence disabled but channel points enabled - showing waiting screen');
                    }
                    this.showWaitingForRedemption();
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
            header.innerHTML = `<div class="channel-name">${this.config.channel.name}</div>`;
            document.body.appendChild(header);
        }
    }

    showLoading() {
        const caseContainer = document.querySelector('.case-container');
        caseContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading cat emotes...</div>
            </div>
        `;
    }

    hideLoading() {
        if (this.config.debug.enableLogging) {
            console.log('🔄 Hiding loading and setting up roller...');
        }
        const caseContainer = document.querySelector('.case-container');
        caseContainer.innerHTML = `
            <div class="roller-container">
                <div class="selection-window"></div>
                <div class="roller-track" id="rollerTrack"></div>
            </div>
        `;
        this.rollerTrack = document.getElementById('rollerTrack');
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
            
            items.push(this.createEmoteTile(randomEmote));
            lastEmote = randomEmote;
        }
        
        if (this.config.debug.enableLogging) {
            console.log('Generated', items.length, 'roller items');
        }
        this.rollerTrack.innerHTML = items.join('');
        if (this.config.debug.enableLogging) {
            console.log('✅ Roller items inserted into DOM, children count:', this.rollerTrack.children.length);
        }
    }

    createEmoteTile(emote) {
        const showBorder = this.config.display.showRarityBorders ? emote.rarity : '';
        const glowDiv = this.config.display.showGlowEffects ? '<div class="rarity-glow"></div>' : '';
        
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
                     onload="${debugOnLoad}"
                     onerror="${debugOnError}"
                     loading="eager"
                     style="width: 80px; height: 80px; object-fit: contain; display: block; border: 3px solid ${rarityColor}; background: rgba(255,255,255,0.1);">
                <div class="emote-name" style="color: white; font-size: 14px; text-align: center; margin-top: 8px; font-weight: bold;">${emote.name}</div>
            </div>
        `;
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
            
            items.push(this.createEmoteTile(currentEmote));
            lastEmote = currentEmote;
        }
        
        this.rollerTrack.innerHTML = items.join('');
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
            caseContainer.innerHTML = `
                <div class="roller-container">
                    <div class="selection-window"></div>
                    <div class="roller-track" id="rollerTrack"></div>
                </div>
            `;
            this.rollerTrack = document.getElementById('rollerTrack');
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
        // Create a waiting display
        const waitingContainer = document.createElement('div');
        waitingContainer.className = 'final-emote-container';
        
        waitingContainer.innerHTML = `
            <div class="cat-title">Cat Of The Day</div>
            <div class="waiting-message">
                <div class="waiting-status">WAITING FOR REDEMPTION</div>
                <div class="waiting-instruction">Redeem "CAT OF THE DAY" with Channel Points</div>
            </div>
        `;
        
        // Replace the case container content
        const caseContainer = document.querySelector('.case-container');
        caseContainer.innerHTML = '';
        caseContainer.appendChild(waitingContainer);
        
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
        // Create an error display
        const errorContainer = document.createElement('div');
        errorContainer.className = 'final-emote-container';
        
        errorContainer.innerHTML = `
            <div class="cat-title">Cat Of The Day</div>
            <div class="waiting-message error">
                <div class="waiting-status error">${errorTitle}</div>
                <div class="waiting-instruction"></div>
            </div>
        `;
        
        // Replace the case container content
        const caseContainer = document.querySelector('.case-container');
        if (caseContainer) {
            caseContainer.innerHTML = '';
            caseContainer.appendChild(errorContainer);
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
        // Create the final emote display
        const finalEmoteContainer = document.createElement('div');
        finalEmoteContainer.className = 'final-emote-container';
        
        const sizeClass = this.config.display.finalEmoteSize === 'large' ? 'final-emote-image' : 'final-emote-image-small';
        const showRarity = this.config.display.showRarityBorders ? emote.rarity : '';
        
        // Add legendary class to title if emote is legendary
        const titleClass = emote.rarity === 'legendary' ? 'cat-title legendary' : 'cat-title';
        
        // Add time remaining if persistence is enabled
        const timeDisplay = this.winnerPersistence && this.config.persistence.showTimeRemaining 
            ? `<div id="timeRemaining" class="time-remaining">Next roll available in: <span id="countdown">Calculating...</span></div>`
            : '';
        
        finalEmoteContainer.innerHTML = `
            <div class="${titleClass}">Cat Of The Day</div>
            ${timeDisplay}
            <div class="final-emote-no-box">
                <img src="${emote.imageUrl}" 
                     alt="${emote.name}" 
                     class="${sizeClass}"
                     onerror="this.onerror=null; this.src='${this.sevenTVAPI ? this.sevenTVAPI.generatePlaceholderSVG(emote.name, this.getRarityColor(emote.rarity)) : ''}';"
                     crossorigin="anonymous">
            </div>
        `;
        
        // Replace the case container content
        const caseContainer = document.querySelector('.case-container');
        caseContainer.innerHTML = '';
        caseContainer.appendChild(finalEmoteContainer);
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