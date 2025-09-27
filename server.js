const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Store room information
const rooms = new Map();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp and random string
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 * 1024, // 5GB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow only video files
        const allowedTypes = /mp4|avi|mov|mkv|webm|flv|wmv|mpeg|mpg|3gp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'));
        }
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join room
    socket.on('join-room', (data) => {
        const { roomId, username } = data;
        
        console.log(`Join room request: ${username} wants to join ${roomId}`);
        
        // Leave any previous rooms
        socket.rooms.forEach(room => {
            if (room !== socket.id) {
                socket.leave(room);
            }
        });

        // Join the new room
        socket.join(roomId);
        socket.username = username;
        socket.roomId = roomId;

        // Initialize room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                users: new Map(),
                currentMedia: {
                    video: null,
                    audio: null
                },
                mediaState: {
                    isPlaying: false,
                    currentTime: 0,
                    lastUpdate: Date.now()
                }
            });
            console.log(`New room created: ${roomId}`);
        }

        const room = rooms.get(roomId);
        room.users.set(socket.id, {
            username: username,
            joinedAt: Date.now()
        });

        console.log(`Room ${roomId} now has ${room.users.size} users`);

        // Notify user about successful join
        socket.emit('room-joined', {
            roomId: roomId,
            username: username,
            userCount: room.users.size,
            currentMedia: room.currentMedia,
            mediaState: room.mediaState
        });

        // Notify other users in the room
        socket.to(roomId).emit('user-joined', {
            username: username,
            userCount: room.users.size,
            users: Array.from(room.users.values()).map(u => u.username)
        });

        // Send current room state to the new user
        socket.emit('room-state', {
            userCount: room.users.size,
            users: Array.from(room.users.values()).map(u => u.username),
            currentMedia: room.currentMedia,
            mediaState: room.mediaState
        });

        console.log(`${username} joined room ${roomId}`);
    });

    // Handle media events (play, pause, seek)
    socket.on('media-event', (data) => {
        const { roomId, action, type, currentTime, timestamp } = data;
        
        if (!rooms.has(roomId)) return;
        
        const room = rooms.get(roomId);
        
        // Update room media state
        room.mediaState = {
            isPlaying: action === 'play',
            currentTime: currentTime,
            lastUpdate: timestamp,
            type: type
        };

        // Broadcast to other users in the room
        socket.to(roomId).emit('media-sync', {
            action: action,
            type: type,
            currentTime: currentTime,
            timestamp: timestamp,
            username: socket.username
        });

        console.log(`Media event in room ${roomId}: ${action} ${type} at ${currentTime}s`);
    });

    // Handle media loading
    socket.on('media-load', (data) => {
        const { roomId, type, source } = data;
        
        if (!rooms.has(roomId)) return;
        
        const room = rooms.get(roomId);
        room.currentMedia[type] = {
            source: source,
            loadedBy: socket.username,
            loadedAt: Date.now()
        };

        // Broadcast to other users in the room
        socket.to(roomId).emit('media-loaded', {
            type: type,
            source: source,
            username: socket.username
        });

        console.log(`Media loaded in room ${roomId}: ${type} - ${source}`);
    });

    // Handle chat messages
    socket.on('chat-message', (data) => {
        const { roomId, message, timestamp } = data;
        
        // Broadcast message to other users in the room
        socket.to(roomId).emit('chat-message', {
            username: socket.username,
            message: message,
            timestamp: timestamp
        });

        console.log(`Chat message in room ${roomId} from ${socket.username}: ${message}`);
    });

    // Handle sync request
    socket.on('request-sync', (data) => {
        const { roomId } = data;
        
        if (!rooms.has(roomId)) return;
        
        const room = rooms.get(roomId);
        
        // Send current media state to requesting user
        socket.emit('sync-response', {
            mediaState: room.mediaState,
            currentMedia: room.currentMedia
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        if (socket.roomId && rooms.has(socket.roomId)) {
            const room = rooms.get(socket.roomId);
            const username = socket.username;
            
            room.users.delete(socket.id);
            
            // Notify other users
            socket.to(socket.roomId).emit('user-left', {
                username: username,
                userCount: room.users.size,
                users: Array.from(room.users.values()).map(u => u.username)
            });

            // Clean up empty rooms
            if (room.users.size === 0) {
                rooms.delete(socket.roomId);
                console.log(`Room ${socket.roomId} deleted (empty)`);
            }
        }
    });
});

// File upload endpoint
app.post('/api/upload', upload.single('video'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const fileUrl = `/uploads/${req.file.filename}`;
        
        res.json({
            success: true,
            url: fileUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
        });
        
        console.log(`File uploaded: ${req.file.originalname} -> ${req.file.filename}`);
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed', message: error.message });
    }
});

// Error handling for file uploads
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large', message: 'Maximum file size is 5GB' });
        }
    }
    res.status(400).json({ error: 'Upload failed', message: error.message });
});

// API endpoints for room management
app.get('/api/rooms', (req, res) => {
    const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
        id: id,
        userCount: room.users.size,
        users: Array.from(room.users.values()).map(u => u.username),
        hasMedia: !!(room.currentMedia.video || room.currentMedia.audio)
    }));
    
    res.json(roomList);
});

// Validate room existence
app.get('/api/room/:id/validate', (req, res) => {
    const roomId = req.params.id;
    
    const exists = rooms.has(roomId);
    res.json({ 
        exists: exists,
        roomId: roomId 
    });
});

app.get('/api/room/:id', (req, res) => {
    const roomId = req.params.id;
    
    if (!rooms.has(roomId)) {
        return res.status(404).json({ error: 'Room not found' });
    }
    
    const room = rooms.get(roomId);
    res.json({
        id: roomId,
        userCount: room.users.size,
        users: Array.from(room.users.values()).map(u => u.username),
        currentMedia: room.currentMedia,
        mediaState: room.mediaState
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 SyncWatch server running on http://localhost:${PORT}`);
    console.log(`📱 Open your browser and navigate to http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});