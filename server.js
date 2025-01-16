const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { stat } = require('fs');
const { hostname } = require('os');

// Initialize express app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


const group = {
  // Formate 
  // "SESSION-KEY1": {
  //   "hostname": "Fenil",
  //   "partner": "Krishna"
  // },
};


// Middleware to parse JSON body
app.use(express.json()); // Add this line

// Serve static files (like CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Home route
app.get('/', (req, res) => {
  res.render('index');
});

// Home route
app.get('/thread', (req, res) => {
  res.render('thread');
});

// Generate key route
app.post('/generate-session-key', (req, res) => {
  const { userName } = req.body;

  if (!userName) {
    return res.status(400).json({ success: false, message: 'User Name is required.' });
  }

  // Generate a unique session key
  const sessionKey_value = `SESSION-${Math.random().toString(36).substr(2, 9)}`;

  // Add the new session to the group
  group[sessionKey_value] = {
    hostname: userName,
    partner: null
  };

  console.log(`THREADS UPDATED:`, group);

  return res.json({ success: true, sessionKey: sessionKey_value, group });
});

app.post('/join-thread', (req, res) => {
  const { threadID, userName } = req.body;

  // Validate input
  if (!threadID || !userName) {
    return res.status(400).json({ success: false, message: "threadID and userName are required." });
  }

  // Check if the thread exists in the group object
  if (group[threadID]) {
    if (group[threadID].partner == null) {
      group[threadID].partner = userName;
      console.log(`THREAD UPDATED:`, group);
      sendProfileUpdate(threadID, userName);
      return res.json({ success: true, message: threadID, group });
    }
    else {
      console.log("Only room for one plus one. No more.");
      return res.status(400).json({ success: false, message: "Only room for one plus one. No more." });
    }

  } else {
    console.log({ success: false, message: "Thread not found." });
    return res.status(404).json({ success: false, message: "Thread not found." });
  }
});

app.post('/getProfileByThreadId', (req, res) => {
  const { threadId, status } = req.body;

  console.log('Thread ID:', threadId); // Log threadId
  console.log('Status:', status); // Log status

  // Check if the threadId exists in the group and retrieve the data
  const session = group[threadId];

  if (session) {
    if (status === "host") {
      res.json({
        partner: session.partner,
      });
    }

    else if (status === "partner") {
      res.json({
        hostname: session.hostname
      });
    }
  } else {
    console.error(`Thread ID ${threadId} not found`);
    res.status(404).json({ error: 'ThreadId not found.' });
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A user connected');

  // When a user joins a session
  socket.on('joinSession', (sessionId) => {
    socket.join(sessionId);
    console.log(`User joined session: ${sessionId}`);
  });

  // Broadcast message to the other person in the same session
  socket.on('chatMessage', (sessionId, msg) => {
    // Emit the message to all other clients in the session except the sender
    socket.to(sessionId).emit('chatMessage', msg);
    console.log(`Message sent in session ${sessionId}: ${msg}`);
  });

  // Disconnect event
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});


// Function to send a message to a hostname from the server
function sendProfileUpdate(sessionId, message) {
  const session = group[sessionId];

  if (session && session.hostname) {
    // Send a special flag with the message to indicate a profile update
    const profileUpdateMessage = {
      type: 'profile-update', // Special type identifier
      message: message,
    };

    io.to(sessionId).emit('chatMessage', profileUpdateMessage); // Emit with type info
    console.log(`Message sent to ${session.hostname} in session ${sessionId}: ${message}`);
  } else {
    console.log(`Hostname ${session.hostname} not found.`);
  }
}



// Start the server
server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});