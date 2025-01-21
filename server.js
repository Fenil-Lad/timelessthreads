const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { green, red, yellow, cyan, magenta } = require('colorette');

// Initialize express app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Group object to store sessions
const group = {};

// Middleware to parse JSON body
app.use(express.json());

// Serve static files (like CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Home route
app.get('/', (req, res) => {
  console.info(green(`[INFO] Serving Home page.`));
  res.render('index');
});

// Thread route
app.get('/thread', (req, res) => {
  console.info(green(`[INFO] Serving Thread page.`));
  res.render('thread');
});

// Generate key route
app.post('/generate-session-key', (req, res) => {
  const { userName } = req.body;

  if (!userName) {
    console.error(red(`[ERROR] User Name not provided.`));
    return res.status(400).json({ success: false, message: 'User Name is required.' });
  }

  const sessionKey_value = `SESSION-${Math.random().toString(36).substr(2, 9)}`;
  group[sessionKey_value] = {
    hostname: userName,
    partner: null,
  };

  console.info(cyan(`[INFO] Session key generated: ${sessionKey_value}`));
  console.info(magenta(`[INFO] Updated Threads:`), group);

  return res.json({ success: true, sessionKey: sessionKey_value, group });
});

// Join thread route
app.post('/join-thread', (req, res) => {
  const { threadID, userName } = req.body;

  if (!threadID || !userName) {
    console.error(red(`[ERROR] threadID or userName not provided.`));
    return res.status(400).json({ success: false, message: 'threadID and userName are required.' });
  }

  if (group[threadID]) {
    if (group[threadID].partner == null) {
      group[threadID].partner = userName;
      console.info(cyan(`[INFO] User ${userName} joined thread: ${threadID}`));
      console.info(magenta(`[INFO] Updated Threads:`), group);
      sendProfileUpdate(threadID, userName);
      return res.json({ success: true, message: threadID, group });
    } else {
      console.warn(yellow(`[WARN] Thread ${threadID} already has a partner.`));
      return res.status(400).json({ success: false, message: 'Only room for one plus one. No more.' });
    }
  } else {
    console.error(red(`[ERROR] Thread ${threadID} not found.`));
    return res.status(404).json({ success: false, message: 'Thread not found.' });
  }
});

// Get profile by thread ID
app.post('/getProfileByThreadId', (req, res) => {
  const { threadId } = req.body;

  console.info(cyan(`[INFO] Fetching profile for Thread ID: ${threadId}`));

  const session = group[threadId];

  if (session) {
    console.info(cyan(`[INFO] Returning session hostname and partner names for Thread ID: ${threadId}`));
    res.json({ hostname: session.hostname, partner: session.partner });
  } else {
    console.error(red(`[ERROR] Thread ID ${threadId} not found.`));
    res.status(404).json({ error: 'ThreadId not found.' });
  }
});

// Socket connection
io.on('connection', (socket) => {
  console.info(green(`[INFO] New connection established: Socket ID ${socket.id}`));

  socket.on('joinSession', (sessionId) => {
    socket.join(sessionId);
    console.info(cyan(`[INFO] Socket ID ${socket.id} joined session: ${sessionId}`));
  });

  socket.on('chatMessage', (sessionId, msg) => {
    socket.to(sessionId).emit('chatMessage', msg);
    console.info(cyan(`[MESSAGE] Session ${sessionId} | Sender: ${socket.id} | Message: "${msg}"`));
  });

  socket.on('disconnect', () => {
    console.warn(yellow(`[WARN] Socket ID ${socket.id} disconnected.`));
  });
});

// Send profile update message to session
function sendProfileUpdate(sessionId, message) {
  const session = group[sessionId];

  if (session && session.hostname) {
    const profileUpdateMessage = {
      type: 'profile-update',
      message: message,
    };

    io.to(sessionId).emit('chatMessage', profileUpdateMessage);
    console.info(cyan(`[INFO] Profile update sent to ${session.hostname} in session ${sessionId}: ${message}`));
  } else {
    console.warn(yellow(`[WARN] Hostname not found for session ${sessionId}.`));
  }
}

// Start the server
server.listen(3000, () => {
  console.info(green(`[INFO] Server is running on http://localhost:3000`));
});
