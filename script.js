class SyncWatch {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.username = null;
        this.isHost = false;
        this.syncTolerance = 1; // seconds
        this.lastSyncTime = 0;
        this.isAgeVerified = false;
        this.chatMinimized = false;
        
        this.initializeElements();
        this.attachEventListeners();
        this.initializeAgeVerification();
        this.initializeThemeToggle();
        this.initializeFeedbackSystem();
        this.initializeSocketConnection();
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
            this.directPlayer.addEventListener('play', () => this.onMediaPlay('video'));
            this.directPlayer.addEventListener('pause', () => this.onMediaPause('video'));
            this.directPlayer.addEventListener('seeked', () => this.onMediaSeek('video'));
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
     this.verifyAge.addEventListener('click', () => {
            const age = parseInt(this.ageInput.value);
            if (age >= 18) {
                this.verifyUserAge();
            } else {
                this.ageError.textContent = 'You must be 18 or older to use this feature.';
                this.ageError.style.display = 'block';
                setTimeout(() => {
                    this.ageError.style.display = 'none';
                }, 3000);
            }
        });
        
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

    handleVideoFile(event) {
        const file = event.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            // Use direct player for local files
            this.directPlayer.src = url;
            this.directPlayer.classList.remove('hidden');
            this.youtubePlayer.classList.add('hidden');
            this.broadcastMediaLoad('video', file.name);
            this.addChatMessage('System', `${this.username} loaded video: ${file.name}`, 'system');
        }
    }



    loadVideoFromUrl() {
        const url = this.videoUrl.value.trim();
        if (url) {
            // Extract video ID from YouTube URL
            const videoId = this.extractYouTubeId(url);
            
            if (videoId) {
                // Create embedded YouTube URL
                const embedUrl = `https://www.youtube.com/embed/${videoId}`;
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



    onMediaPlay(type) {
        this.broadcastMediaEvent('play', type, this.directPlayer.currentTime);
        this.updateSyncStatus('synced');
    }

    onMediaPause(type) {
        this.broadcastMediaEvent('pause', type, this.directPlayer.currentTime);
        this.updateSyncStatus('synced');
    }

    onMediaSeek(type) {
        this.broadcastMediaEvent('seek', type, this.directPlayer.currentTime);
        this.updateSyncStatus('synced');
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
        
        // Don't sync our own events
        if (username === this.username) return;
        
        // Only handle video sync (audio removed)
        if (type !== 'video') return;
        
        // Apply the synchronization
        switch (action) {
            case 'play':
                this.directPlayer.currentTime = currentTime;
                this.directPlayer.play().catch(e => console.log('Play failed:', e));
                break;
            case 'pause':
                this.directPlayer.currentTime = currentTime;
                this.directPlayer.pause();
                break;
            case 'seek':
                this.directPlayer.currentTime = currentTime;
                break;
        }
        
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
        } else {
            this.directPlayer.src = source;
            this.directPlayer.classList.remove('hidden');
            this.youtubePlayer.classList.add('hidden');
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
        this.ageModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    verifyUserAge() {
        const age = parseInt(this.ageInput.value);
        
        if (age === 18) {
            this.isAgeVerified = true;
            this.ageModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            this.addChatMessage('System', 'Welcome to SyncWatch! Age verification successful.', 'system');
        } else {
            this.ageError.textContent = 'You are not eligible. Thanks for using our site.';
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
    
    // Feedback system functionality
    initializeFeedbackSystem() {
        // Initialize feedback form elements
        this.feedbackName = document.getElementById('feedbackName');
        this.feedbackEmail = document.getElementById('feedbackEmail');
        this.feedbackRating = document.getElementById('feedbackRating');
        this.feedbackMessage = document.getElementById('feedbackMessage');
    }
    
    openFeedbackModal() {
        this.feedbackModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    closeFeedbackModal() {
        this.feedbackModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        this.feedbackForm.reset();
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

// Service Worker registration for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
