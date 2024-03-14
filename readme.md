# Node.js SQLite3 Setup

Database file name is dirWatcher.db

## Install required npm packages

npm install

## Run the Node.js application

npm start

## Use REST API endpoints to configure, start, stop, and retrieve task run details as needed.

curl for rest apis

curl --location 'http://localhost:3000/config'

curl --location 'http://localhost:3000/config' \
--header 'Content-Type: application/json' \
--data '{
"monitoredDirectory": "D:/dirWatcher/dir",
"interval": 60000,
"magicString": "Lumel"
}'

curl --location 'http://localhost:3000/task-details'

curl --location --request POST 'http://localhost:3000/stop-task'

curl --location --request POST 'http://localhost:3000/start-task' \
--data ''

## Note: Using the rest API is necessary to start the task after starting the app.
