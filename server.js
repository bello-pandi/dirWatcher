const express = require('express');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const util = require('util');
const { setInterval } = require('timers');
const bodyParser = require('body-parser');
const {v4 : uuidv4} = require('uuid')


const app = express();
const port = 3000;
app.use(bodyParser.json());

// SQLite database setup
const db = new sqlite3.Database('dirWatcher.db');

// Promisify the db.get method
const getAsync = util.promisify(db.get).bind(db);

// Promisify the db.all method
const getAllAsync = util.promisify(db.all).bind(db);

// Promisify the db.run method
const runAsync = util.promisify(db.run).bind(db);


db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR PRIMARY KEY,
    start_time TEXT,
    end_time TEXT,
    total_runtime INTEGER,
    files_added TEXT,
    files_deleted TEXT,
    total_files TEXT,
    magic_string_occurrences INTEGER,
    status VARCHAR
  )`);
});

// Set the verbose mode
db.on('trace', (query) => {
    console.log('Query:', query);
  });

// Configuration
let monitoredDirectory = 'D:/dirWatcher/dir';
let interval = 1000; // 1 minute interval by default
let magicString = 'Lumel';

// Long running background task
let taskInterval;

function runTask() {
  try {
    taskInterval = setInterval(() => {
      const startTime = new Date().toISOString();
  
      // Read directory contents
      fs.readdir(monitoredDirectory, async (err, files) => {
        if (err) {
          console.error('Error reading directory:', err);
          return;
        }
  
        let filesAdded = [];
        let filesDeleted = [];
        let magicStringOccurrences = 0;
        let addFilecheck = [];
        let deleteFilecheck = [];
        let totalFiles = [];

        const row = await getAsync('SELECT total_files FROM tasks ORDER BY id DESC LIMIT 1');
        if (row && row.total_files) {
          totalFiles = JSON.parse(row.total_files);
          addFilecheck = files.filter(file => !totalFiles.includes(file));
          deleteFilecheck = totalFiles.filter(file => !files.includes(file));
          if(addFilecheck.length > 0 || deleteFilecheck.length >0){
            //Get added files
            filesAdded = files.filter(file => !totalFiles.includes(file));
            //Get deleted file files
            filesDeleted = totalFiles.filter(file => !files.includes(file));
          }
        }else{
          filesAdded = files;
        }
  
          // Count magic string occurrences
          files.forEach(file => {
            const filePath = `${monitoredDirectory}/${file}`;
            const content = fs.readFileSync(filePath, 'utf8');
            magicStringOccurrences += (content.match(new RegExp(magicString, 'g')) || []).length;
          });
  
          const endTime = new Date().toISOString();
          const totalRuntime = new Date(endTime) - new Date(startTime);
  
          // Save task details to the database
          await runAsync(`INSERT INTO tasks (id, start_time, end_time, total_runtime, files_added, files_deleted,total_files, magic_string_occurrences, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [uuidv4(),startTime, endTime, totalRuntime, JSON.stringify(filesAdded), JSON.stringify(filesDeleted), JSON.stringify(files), magicStringOccurrences, 'success']);
      });
    }, interval);
  } catch (error) {
    console.error('Error running task:', error);
  }
  
}

// REST API endpoints
app.get('/config', (req, res) => {
  try {
    res.send({
      monitoredDirectory,
      interval,
      magicString
    });
  } catch (error) {
    console.error('Error handling request to /config:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

app.post('/config', (req, res) => {
  try {
    let { monitoredDirectory, interval, magicString } = req.body;

    if (!monitoredDirectory || !interval || !magicString) {
      res.status(400).send({ error: 'Missing parameters' });
      return;
    }

    // Update configuration
    monitoredDirectory = monitoredDirectory;
    interval = interval;
    magicString = magicString;
  
    res.send({ msg: 'Configuration updated successfully.'});
  } catch (error) {
    console.error('Error handling request to /config:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

app.get('/task-details', async (req, res) => {
  try {
    // Retrieve task run details from the database
    const taskDetails = await getAllAsync('SELECT * FROM tasks');
    res.status(200).send(taskDetails);
  } catch (error) {
    console.error('Error retrieving task details:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

app.post('/start-task', (req, res) => {
  try {
    if (!taskInterval) {
      runTask();
      res.send({ msg: 'Task started successfully.'});
    } else {
      res.send({ msg: 'Task is already running.'});
    }
  } catch (error) {
    console.error('Error starting task:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

app.post('/stop-task', (req, res) => {
  try {
    if (taskInterval) {
      clearInterval(taskInterval);
      taskInterval = undefined;
      res.status(200).send({ msg: 'Task stopped successfully.'});
    } else {
      res.status(200).send({ msg: 'Task is not running.'});
    }
  } catch (error) {
    console.error('Error stopping task:', error);
    res.status(403).send({ error: 'Getting error while stop the task'});
  }
  
});

// Error middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ error: 'Something broke!'});
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});
