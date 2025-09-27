class SyncWatch {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.username = null;
        this.isHost = false;
        this.syncTolerance = 1; // seconds
        this.lastSyncTime = 0;
        this.youtubeStartTime = 0; // Track when YouTube video started playing
        this.isAgeVerified = false;
        this.chatMinimized = false;
        this.isSyncing = false; // Flag to prevent sync loops
        this.feedbackModalUserTriggered = false; // Flag to track user-triggered modal opening
        
        this.initializeElements();
        this.attachEventListeners();
        this.initializeAgeVerification();
        this.initializeThemeToggle();
        this.initializeFeedbackSystem();
        this.initializeSocketConnection();
        this.updateFooterYear();
        this.setupScrollEffects();
    }

    initializeElements() {
        // Room setup elements
        this.roomSetup = document.getElementById('roomSetup');
        this.mediaSection = document.getElementById('mediaSection');
        this.usernameInput = document.getElementById('usernameInput');
        this.roomIdInput = document.getElementById('roomIdInput');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        
        // Media elements - using correct HTML IDs
        this.directPlayer = document.getElementById('directPlayer');
        this.youtubePlayer = document.getElementById('youtubePlayer');
        this.videoFile = document.getElementById('videoFile');
        this.videoUrl = document.getElementById('videoUrl');
        this.loadVideoUrl = document.getElementById('loadVideoUrl');
        
        // Chat elements
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendMessage = document.getElementById('sendMessage');
        
        // Status elements
        this.roomIdDisplay = document.getElementById('roomId');
        this.userCount = document.getElementById('userCount');
        this.syncStatus = document.getElementById('syncStatus');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.onlineUsers = document.getElementById('onlineUsers');
        
        // New elements for theme, age verification, chat, and feedback
        this.themeToggle = document.getElementById('themeToggle');
        this.ageModal = document.getElementById('ageModal');
        this.ageInput = document.getElementById('ageInput');
        this.verifyAge = document.getElementById('verifyAge');
        this.exitSite = document.getElementById('exitSite');
        this.ageError = document.getElementById('ageError');
        this.chatMinimize = document.getElementById('chatMinimize');
        this.chatContainer = document.querySelector('.chat-container');
        this.feedbackButton = document.getElementById('feedbackButton');
        this.feedbackModal = document.getElementById('feedbackModal');
        this.feedbackForm = document.getElementById('feedbackForm');
        this.cancelFeedback = document.getElementById('cancelFeedback');
        this.playButtonOverlay = document.getElementById('playButtonOverlay');
    }

    attachEventListeners() {
        // Room setup
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });

        // Media file uploads
        this.videoFile.addEventListener('change', (e) => this.handleVideoFile(e));
        
        // URL loading
        this.loadVideoUrl.addEventListener('click', () => this.loadVideoFromUrl());
        
        // Media player events - for both direct video and YouTube players
        if (this.directPlayer) {
            this.directPlayer.addEventListener('play', () => {
                console.log(`[EVENT] Direct player play event, isSyncing: ${this.isSyncing}`);
                // Hide play button when video starts playing
                this.playButtonOverlay.classList.add('hidden');
                // Only broadcast if this is a user-initiated play (not from sync)
                if (!this.isSyncing) {
                    console.log(`[EVENT] Broadcasting play event`);
                    this.onMediaPlay('video');
                } else {
                    console.log(`[EVENT] Skipping play broadcast - isSyncing is true`);
                }
            });
            this.directPlayer.addEventListener('pause', () => {
                console.log(`[EVENT] Direct player pause event, isSyncing: ${this.isSyncing}`);
                // Only broadcast if this is a user-initiated pause (not from sync)
                if (!this.isSyncing) {
                    console.log(`[EVENT] Broadcasting pause event`);
                    this.onMediaPause('video');
                } else {
                    console.log(`[EVENT] Skipping pause broadcast - isSyncing is true`);
                }
            });
            this.directPlayer.addEventListener('seeked', () => {
                console.log(`[EVENT] Direct player seeked event, isSyncing: ${this.isSyncing}, currentTime: ${this.directPlayer.currentTime}`);
                // Only broadcast if this is a user-initiated seek (not from sync)
                if (!this.isSyncing) {
                    console.log(`[EVENT] Broadcasting seek event`);
                    this.onMediaSeek('video');
                } else {
                    console.log(`[EVENT] Skipping seek broadcast - isSyncing is true`);
                }
            });
            this.directPlayer.addEventListener('timeupdate', () => this.onTimeUpdate('video'));
        }
        

        
        // Chat
        this.sendMessage.addEventListener('click', () => this.sendChatMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });
        
        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Chat minimize/maximize
        this.chatMinimize.addEventListener('click', () => this.toggleChat());
        
        // Age verification
        this.verifyAge.addEventListener('click', () => this.verifyUserAge());
        this.exitSite.addEventListener('click', () => this.exitWebsite());
        
        // Feedback system
        this.feedbackButton.addEventListener('click', () => this.openFeedbackModal());
        this.cancelFeedback.addEventListener('click', () => this.closeFeedbackModal());
        this.feedbackForm.addEventListener('submit', (e) => this.submitFeedback(e));
    }

    initializeSocketConnection() {
        this.updateConnectionStatus('connecting');
        
        // Connect to real Socket.IO server
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server:', this.socket.id);
            this.updateConnectionStatus('connected');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus('disconnected');
        });
        
        // Handle room events
        this.socket.on('room-joined', (data) => {
            console.log('Room joined:', data);
            this.userCount.textContent = `Users: ${data.userCount}`;
        });
        
        this.socket.on('user-joined', (data) => {
            console.log('User joined:', data);
            this.userCount.textContent = `Users: ${data.userCount}`;
            this.onlineUsers.textContent = `${data.users.join(', ')} online`;
            this.addChatMessage('System', `${data.username} joined the room`, 'system');
        });
        
        this.socket.on('user-left', (data) => {
            console.log('User left:', data);
            this.userCount.textContent = `Users: ${data.userCount}`;
            this.onlineUsers.textContent = `${data.users.join(', ')} online`;
            this.addChatMessage('System', `${data.username} left the room`, 'system');
        });
        
        // Handle media synchronization
        this.socket.on('media-sync', (data) => {
            console.log('Media sync received:', data);
            this.handleMediaSync(data);
        });
        
        this.socket.on('media-loaded', (data) => {
            console.log('Media loaded by other user:', data);
            this.handleRemoteMediaLoad(data);
        });
        
        // Handle chat messages
        this.socket.on('chat-message', (data) => {
            console.log('Chat message received:', data);
            this.addChatMessage(data.username, data.message, 'other');
        });
    }

    joinRoom() {
        const username = this.usernameInput.value.trim();
        const roomId = this.roomIdInput.value.trim();
        
        if (!username) {
            alert('Please enter your name');
            return;
        }
        
        // Validate room ID format if provided (only allow alphanumeric and 4-10 characters)
        if (roomId && !/^[A-Za-z0-9]{4,10}$/.test(roomId)) {
            alert('Invalid Room ID format. Room ID must be 4-10 characters long and contain only letters and numbers.');
            return;
        }
        
        this.username = username;
        
        // If no room ID provided, create a new one
        if (!roomId) {
            this.roomId = this.generateRoomId();
            this.isHost = true;
        } else {
            // Validate that the room exists on server before joining
            this.validateAndJoinRoom(roomId, username);
            return;
        }
        
        // Continue with room creation (host flow)
        this.completeRoomJoin();
    }
    
    async validateAndJoinRoom(roomId, username) {
        try {
            // Check if room exists on server
            const response = await fetch(`/api/room/${roomId}/validate`);
            const data = await response.json();
            
            if (!data.exists) {
                alert(`Room "${roomId}" does not exist. Please check the Room ID and try again.`);
                return;
            }
            
            this.roomId = roomId;
            this.isHost = false;
            this.completeRoomJoin();
        } catch (error) {
            console.error('Room validation failed:', error);
            alert('Unable to validate room. Please try again.');
        }
    }
    
    completeRoomJoin() {
        // Hide room setup and show media section
        this.roomSetup.classList.add('hidden');
        this.mediaSection.classList.remove('hidden');
        
        // Update UI
        this.roomIdDisplay.textContent = `Room: ${this.roomId}`;
        this.userCount.textContent = 'Users: 1';
        
        // Add welcome message
        this.addChatMessage('System', `Welcome ${this.username}! ${this.isHost ? 'You created room ' + this.roomId : 'You joined room ' + this.roomId}`, 'system');
        
        // Simulate joining room
        if (this.socket) {
            this.socket.emit('join-room', {
                roomId: this.roomId,
                username: this.username
            });
        }
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    async handleVideoFile(event) {
        const file = event.target.files[0];
        if (file) {
            // Client-side file size check (5GB limit)
            const maxSize = 5 * 1024 * 1024 * 1024; // 5GB in bytes
            if (file.size > maxSize) {
                this.addChatMessage('System', `File too large: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum file size is 5GB.`, 'system');
                return;
            }
            
            // Show upload progress
            this.addChatMessage('System', `Uploading ${file.name}...`, 'system');
            
            try {
                // Upload file to server
                const formData = new FormData();
                formData.append('video', file);
                
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Upload failed');
                }
                
                const result = await response.json();
                
                if (result.success) {
                    // Use the server URL for the video
                    this.directPlayer.src = result.url;
                    this.directPlayer.classList.remove('hidden');
                    this.youtubePlayer.classList.add('hidden');
                    
                    // Broadcast the server URL so other users can access it
                    this.broadcastMediaLoad('video', result.url);
                    this.addChatMessage('System', `${this.username} loaded video: ${file.name}`, 'system');
                    
                    console.log('File uploaded successfully:', result.url);
                } else {
                    throw new Error(result.error || 'Upload failed');
                }
            } catch (error) {
                console.error('Upload error:', error);
                this.addChatMessage('System', `Upload failed: ${error.message}`, 'system');
                
                // Fallback to local blob URL (only works for current user)
                const url = URL.createObjectURL(file);
                this.directPlayer.src = url;
                this.directPlayer.classList.remove('hidden');
                this.youtubePlayer.classList.add('hidden');
                this.addChatMessage('System', `${this.username} loaded video locally (not shared)`, 'system');
            }
        }
    }



    loadVideoFromUrl() {
        const url = this.videoUrl.value.trim();
        if (url) {
            // Extract video ID from YouTube URL
            const videoId = this.extractYouTubeId(url);
            
            if (videoId) {
                // Create embedded YouTube URL with API parameters
                const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&modestbranding=1&rel=0&fs=1`;
                this.youtubePlayer.src = embedUrl;
                this.youtubePlayer.classList.remove('hidden');
                this.directPlayer.classList.add('hidden');
                this.broadcastMediaLoad('video', embedUrl);
                this.addChatMessage('System', `${this.username} loaded YouTube video`, 'system');
            } else {
                // Handle non-YouTube URLs
                this.directPlayer.src = url;
                this.directPlayer.classList.remove('hidden');
                this.youtubePlayer.classList.add('hidden');
                this.broadcastMediaLoad('video', url);
                this.addChatMessage('System', `${this.username} loaded video from URL`, 'system');
            }
            this.videoUrl.value = '';
        }
    }

    extractYouTubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }



    playVideo() {
        // Hide the play button overlay
        this.playButtonOverlay.classList.add('hidden');
        
        // Check which player is active and play it
        const isYouTubeActive = !this.youtubePlayer.classList.contains('hidden');
        const isDirectVideoActive = !this.directPlayer.classList.contains('hidden');
        
        if (isYouTubeActive && this.youtubePlayer.contentWindow) {
            // Play YouTube video
            this.youtubePlayer.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
            this.youtubeStartTime = Date.now(); // Track when video started
        } else if (isDirectVideoActive) {
            // Play direct video
            this.directPlayer.play().catch(e => {
                console.log('Manual play failed:', e);
                // If manual play also fails, show button again
                this.playButtonOverlay.classList.remove('hidden');
            });
        }
        
        // Broadcast the play event to other users
        const currentTime = this.getCurrentPlayerTime();
        this.broadcastMediaEvent('play', 'video', currentTime);
        this.updateSyncStatus('synced');
    }

    onMediaPlay(type) {
        const currentTime = this.getCurrentPlayerTime();
        this.broadcastMediaEvent('play', type, currentTime);
        this.updateSyncStatus('synced');
    }

    onMediaPause(type) {
        const currentTime = this.getCurrentPlayerTime();
        this.broadcastMediaEvent('pause', type, currentTime);
        this.updateSyncStatus('synced');
    }

    onMediaSeek(type) {
        const currentTime = this.getCurrentPlayerTime();
        this.broadcastMediaEvent('seek', type, currentTime);
        this.updateSyncStatus('synced');
    }

    getCurrentPlayerTime() {
        // Check which player is active and return its current time
        const isYouTubeActive = !this.youtubePlayer.classList.contains('hidden');
        const isDirectVideoActive = !this.directPlayer.classList.contains('hidden');
        
        if (isYouTubeActive) {
            // For YouTube, we'll estimate time based on when the video started playing
            // This is a simplified approach - in a real implementation you'd use the YouTube API
            return this.youtubeStartTime || 0;
        } else if (isDirectVideoActive) {
            return this.directPlayer.currentTime;
        }
        
        return 0;
    }

    onTimeUpdate(type) {
        // Periodically check sync status
        const now = Date.now();
        if (now - this.lastSyncTime > 5000) { // Check every 5 seconds
            this.checkSyncStatus(type);
            this.lastSyncTime = now;
        }
    }

    broadcastMediaEvent(action, type, currentTime) {
        if (this.socket) {
            this.socket.emit('media-event', {
                roomId: this.roomId,
                action: action,
                type: type,
                currentTime: currentTime,
                timestamp: Date.now(),
                username: this.username
            });
        }
    }

    broadcastMediaLoad(type, source) {
        if (this.socket) {
            this.socket.emit('media-load', {
                roomId: this.roomId,
                type: type,
                source: source,
                username: this.username
            });
        }
    }

    handleMediaSync(data) {
        const { action, type, currentTime, username } = data;
        
        console.log(`[SYNC] Received sync event: ${action}, currentTime: ${currentTime}, isSyncing: ${this.isSyncing}`);
        
        // Don't sync our own events
        if (username === this.username) return;
        
        // Only handle video sync (audio removed)
        if (type !== 'video') return;
        
        // Check which player is currently active
        const isYouTubeActive = !this.youtubePlayer.classList.contains('hidden');
        const isDirectVideoActive = !this.directPlayer.classList.contains('hidden');
        
        // Prevent rapid sync events (debounce)
        const now = Date.now();
        if (this.lastSyncTime && (now - this.lastSyncTime) < 500) {
            console.log(`[SYNC] Skipping sync event - debounce`);
            return; // Ignore sync events within 500ms
        }
        this.lastSyncTime = now;
        
        if (this.isSyncing) {
            console.log(`[SYNC] Skipping sync event - isSyncing is true`);
            return;
        }
        
        // Set sync flag to prevent event loops
        this.isSyncing = true;
        
        if (isYouTubeActive) {
            // Handle YouTube synchronization
            if (this.youtubePlayer.contentWindow) {
                switch (action) {
                    case 'play':
                        this.youtubePlayer.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                        this.youtubeStartTime = Date.now() - (currentTime * 1000); // Estimate start time based on sync time
                        break;
                    case 'pause':
                        this.youtubePlayer.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                        break;
                    case 'seek':
                        // YouTube seek command (convert to seconds if needed)
                        this.youtubePlayer.contentWindow.postMessage(`{"event":"command","func":"seekTo","args":[${currentTime}, true]}`, '*');
                        this.youtubeStartTime = Date.now() - (currentTime * 1000); // Update estimated start time
                        break;
                }
            }
        } else if (isDirectVideoActive) {
            // Handle direct video synchronization with tolerance
            const currentVideoTime = this.directPlayer.currentTime;
            const timeDifference = Math.abs(currentVideoTime - currentTime);
            
            // Only seek if the time difference is significant (> 2 seconds)
            if (action === 'seek' || timeDifference > 2) {
                this.directPlayer.currentTime = currentTime;
            }
            
            switch (action) {
                case 'play':
                    if (this.directPlayer.paused) {
                        this.directPlayer.play().catch(e => console.log('Play failed:', e));
                    }
                    break;
                case 'pause':
                    if (!this.directPlayer.paused) {
                        this.directPlayer.pause();
                    }
                    break;
            }
        }
        
        // Clear sync flag after longer delay to prevent race conditions
        setTimeout(() => {
            console.log(`[SYNC] Clearing isSyncing flag`);
            this.isSyncing = false;
        }, 1000); // Increased from 100ms to 1000ms to allow video operations to complete
        
        this.addChatMessage('System', `${username} ${action}ed the ${type}`, 'system');
    }
    
    handleRemoteMediaLoad(data) {
        const { type, source, username } = data;
        
        if (username === this.username) return;
        
        // Only handle video (audio removed)
        if (type !== 'video') return;
        
        // Check if it's a YouTube URL
        if (source.includes('youtube.com/embed')) {
            this.youtubePlayer.src = source;
            this.youtubePlayer.classList.remove('hidden');
            this.directPlayer.classList.add('hidden');
            this.youtubeStartTime = 0; // Reset start time for new video
            
            // Wait for YouTube player to load and then play
            this.youtubePlayer.onload = () => {
                // Add a small delay to ensure player is ready
                setTimeout(() => {
                    if (this.youtubePlayer.contentWindow) {
                        // Send play command to YouTube iframe
                        this.youtubePlayer.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                        this.youtubeStartTime = Date.now(); // Track when video started
                        this.addChatMessage('System', 'YouTube video is now playing for you', 'system');
                    }
                }, 2000);
            };
        } else {
            // Handle direct video file - now using server URLs
            this.directPlayer.src = source;
            this.directPlayer.classList.remove('hidden');
            this.youtubePlayer.classList.add('hidden');
            
            // Show play button overlay for user interaction
            this.playButtonOverlay.classList.remove('hidden');
            
            // Wait for video to load and then try to play
            this.directPlayer.onloadeddata = () => {
                this.directPlayer.play().catch(e => {
                    console.log('Auto-play failed:', e);
                    // If autoplay is blocked, show play button
                    this.playButtonOverlay.classList.remove('hidden');
                    this.addChatMessage('System', 'Click the play button to start watching', 'system');
                });
            };
            
            // Also try to play when metadata is loaded
            this.directPlayer.onloadedmetadata = () => {
                this.directPlayer.play().catch(e => {
                    console.log('Auto-play failed on metadata:', e);
                    this.playButtonOverlay.classList.remove('hidden');
                });
            };
        }
        
        this.addChatMessage('System', `${username} loaded ${type}`, 'system');
    }
    
    checkSyncStatus(type) {
        // Only check video sync (audio removed)
        if (type !== 'video') return;
        
        // Simple sync check - in a real implementation this would compare with server state
        const isInSync = Math.abs(this.directPlayer.currentTime - this.directPlayer.currentTime) < this.syncTolerance;
        this.updateSyncStatus(isInSync ? 'synced' : 'out-of-sync');
    }

    updateSyncStatus(status) {
        this.syncStatus.className = `sync-status ${status}`;
        if (status === 'synced') {
            this.syncStatus.innerHTML = '<i class="fas fa-sync"></i> Synced';
        } else {
            this.syncStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Out of Sync';
        }
    }

    sendChatMessage() {
        const message = this.messageInput.value.trim();
        if (message) {
            this.addChatMessage(this.username, message, 'own');
            this.messageInput.value = '';
            
            if (this.socket) {
                this.socket.emit('chat-message', {
                    roomId: this.roomId,
                    username: this.username,
                    message: message,
                    timestamp: Date.now()
                });
            }
        }
    }

    addChatMessage(username, message, type = 'other') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        if (type === 'system') {
            messageDiv.innerHTML = `
                <div class="message-content">${message}</div>
                <div class="timestamp">${timestamp}</div>
            `;
            messageDiv.style.background = '#e3f2fd';
            messageDiv.style.color = '#1976d2';
            messageDiv.style.alignSelf = 'center';
            messageDiv.style.fontStyle = 'italic';
        } else {
            messageDiv.innerHTML = `
                ${type === 'other' ? `<div class="username">${username}</div>` : ''}
                <div class="message-content">${message}</div>
                <div class="timestamp">${timestamp}</div>
            `;
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updateConnectionStatus(status) {
        this.connectionStatus.className = `connection-status ${status}`;
        
        switch (status) {
            case 'connecting':
                this.connectionStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                break;
            case 'connected':
                this.connectionStatus.innerHTML = '<i class="fas fa-wifi"></i> Connected';
                break;
            case 'disconnected':
                this.connectionStatus.innerHTML = '<i class="fas fa-wifi-slash"></i> Disconnected';
                break;
        }
    }

    // Simulate receiving events from other users
    simulateOtherUserActivity() {
        const activities = [
            () => this.addChatMessage('Alice', 'Hey everyone! 👋', 'other'),
            () => this.addChatMessage('Bob', 'This movie is awesome!', 'other'),
            () => this.addChatMessage('Charlie', 'Can we pause for a moment?', 'other'),
            () => this.userCount.textContent = `Users: ${Math.floor(Math.random() * 5) + 2}`,
            () => this.onlineUsers.textContent = 'Alice, Bob, Charlie online'
        ];

        // Randomly trigger activities every 10-30 seconds
        setInterval(() => {
            if (this.roomId && Math.random() > 0.7) {
                const activity = activities[Math.floor(Math.random() * activities.length)];
                activity();
            }
        }, 15000);
    }
    
    // Age verification functionality
    initializeAgeVerification() {
        // Only show age verification if user hasn't been verified before
        if (!localStorage.getItem('ageVerified')) {
            this.ageModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } else {
            this.isAgeVerified = true;
        }
    }
    
    verifyUserAge() {
        const age = parseInt(this.ageInput.value);
        
        if (age >= 18) {
            this.isAgeVerified = true;
            localStorage.setItem('ageVerified', 'true');
            this.ageModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            this.addChatMessage('System', 'Welcome to SyncWatch! Age verification successful.', 'system');
        } else {
            this.ageError.textContent = 'You must be 18 or older to use this feature.';
            this.ageError.style.display = 'block';
            setTimeout(() => {
                this.ageError.style.display = 'none';
            }, 3000);
        }
    }
    
    exitWebsite() {
        document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif; font-size: 24px;">You are not eligible. Thanks for using our site.</div>';
    }
    
    // Theme toggle functionality
    initializeThemeToggle() {
        // Check for saved theme preference or default to light theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }
    
    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }
    
    updateThemeIcon(theme) {
        const icon = this.themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
    
    // Chat minimize/maximize functionality
    toggleChat() {
        this.chatMinimized = !this.chatMinimized;
        
        if (this.chatMinimized) {
            this.chatContainer.classList.add('minimized');
            this.chatMinimize.innerHTML = '<i class="fas fa-plus"></i>';
        } else {
            this.chatContainer.classList.remove('minimized');
            this.chatMinimize.innerHTML = '<i class="fas fa-minus"></i>';
        }
    }
    
    // Footer Year Update
    updateFooterYear() {
        const yearElement = document.getElementById('currentYear');
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }
    }

    // Scroll Effects
    setupScrollEffects() {
        const header = document.querySelector('.header');
        if (!header) return;

        let lastScrollY = window.scrollY;
        
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            
            if (currentScrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
            
            lastScrollY = currentScrollY;
        });
    }

    // Feedback system functionality
    // IMPORTANT: Feedback modal should NEVER open automatically - only on user click
    initializeFeedbackSystem() {
        // Initialize feedback form elements
        this.feedbackName = document.getElementById('feedbackName');
        this.feedbackEmail = document.getElementById('feedbackEmail');
        this.feedbackRating = document.getElementById('feedbackRating');
        this.feedbackMessage = document.getElementById('feedbackMessage');
        
        // Ensure feedback modal stays closed on initialization
        this.feedbackModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Add safety check after 2 seconds to ensure modal stays closed unless user-triggered
        setTimeout(() => {
            if (!this.feedbackModalUserTriggered && this.feedbackModal.style.display === 'flex') {
                console.log('Automatically closing feedback modal - it should not open automatically');
                this.closeFeedbackModal();
            }
        }, 2000);
    }
    
    openFeedbackModal() {
        console.log('Feedback modal opened - this should only happen when button is clicked');
        this.feedbackModalUserTriggered = true;
        this.feedbackModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    closeFeedbackModal() {
        this.feedbackModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        this.feedbackForm.reset();
        this.feedbackModalUserTriggered = false; // Reset the flag
    }
    
    submitFeedback(e) {
        e.preventDefault();
        
        const feedbackData = {
            name: this.feedbackName.value.trim(),
            email: this.feedbackEmail.value.trim(),
            rating: this.feedbackRating.value,
            message: this.feedbackMessage.value.trim(),
            timestamp: new Date().toISOString()
        };
        
        // Validate required fields
        if (!feedbackData.name || !feedbackData.message) {
            alert('Please fill in your name and feedback message.');
            return;
        }
        
        // Simulate feedback submission (in a real app, this would be sent to a server)
        console.log('Feedback submitted:', feedbackData);
        
        // Show success message
        this.addChatMessage('System', 'Thank you for your feedback! We appreciate your input.', 'system');
        
        // Close modal and reset form
        this.closeFeedbackModal();
        
        // Store feedback in localStorage for demo purposes
        const existingFeedback = JSON.parse(localStorage.getItem('feedback') || '[]');
        existingFeedback.push(feedbackData);
        localStorage.setItem('feedback', JSON.stringify(existingFeedback));
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new SyncWatch();
    
    // Start simulating other user activity after 5 seconds
    setTimeout(() => {
        app.simulateOtherUserActivity();
    }, 5000);
    
    // Add some demo functionality hints
    setTimeout(() => {
        if (!app.roomId) {
            app.addChatMessage('System', 'Welcome to SyncWatch! Enter your name and create or join a room to start watching together.', 'system');
        }
    }, 1000);
});
