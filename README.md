# onecouch

OneCouch is an app that lets you watch videos with friends, with automatic syncing of video time, pause/play etc, live video and mic over WebRTC, and watch parties of 4-ish people (due to WebRTC limitations)

## Demo

https://user-images.githubusercontent.com/64739773/159150175-4b12a809-3e6f-46d1-9dbb-ac1a42c8ace4.mp4


## Usage
`npm install` to install dependencies then run `node server.js`. By default this runs on port 3000. Works fine locally.

To use with friends, you'll need a HTTPS certificate for WebRTC to work properly in modern browsers, so you'll probably want to grab a domain name, register a certificate, and point your DNS servers to wherever you're running the Node server.
