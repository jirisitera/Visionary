import {
  DrawingUtils,
  FilesetResolver,
  GestureRecognizer
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
// define constants
const camera = window.document.getElementById("camera");
const output = window.document.getElementById("output");
const canvas = window.document.getElementById("canvas");
const startButton = window.document.getElementById("startButton");
const addButton = window.document.getElementById("addButton");
const removeButton = window.document.getElementById("removeButton");
const drawingCanvas = canvas.getContext("2d");
// define variables
let recognizer;
let cameraStatus;
let resultsCache;
let lastTime;
let lastKeybind;
let x = 0;
let y = 0;
let lastX = 0;
let lastY = 0;
// prepare mqtt client
const parameters = new URLSearchParams(window.location.search);
const url = parameters.get("url")
const port = parameters.get("port")
const topic = parameters.get("topic")
if (url !== null && port !== null && topic !== null) {
  const client = mqtt.connect("wss://" + url + ":" + port + "/mqtt", {
    clean: true,
    connectTimeout: 4000,
    clientId: crypto.randomUUID(),
    username: "",
    password: "",
  })
  const topicX = topic + "_x"
  const topicY = topic + "_y"
  client.subscribe(topic)
  client.subscribe(topicX)
  client.subscribe(topicY)
  window.setInterval(sendGesture, 1000);
  window.setInterval(sendLocation, 1000);
}
// load model
const createGestureRecognizer = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  recognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 2
  });
};
createGestureRecognizer();
// button functionality
startButton.addEventListener("click", enableWebcam);
addButton.addEventListener("click", addKeybind);
removeButton.addEventListener("click", removeKeybind);

function addKeybind() {
  const table = document.getElementById("keybinds");
  const row = table.rows[1];
  const clone = row.cloneNode(true);
  table.appendChild(clone);
}

function removeKeybind() {
  const table = document.getElementById("keybinds");
  if (table.rows.length > 2) {
    table.deleteRow(table.rows.length - 1);
  }
}

function oppositeHand(hand) {
  return hand === "Left" ? "Right" : "Left";
}

async function enableWebcam() {
  if (cameraStatus === true) {
    cameraStatus = false;
    startButton.innerText = "UNPAUSE VISIONARY GESTURE RECOGNITION";
  } else {
    cameraStatus = true;
    startButton.innerText = "PAUSE VISIONARY GESTURE RECOGNITION";
  }
  window.navigator.mediaDevices.getUserMedia({video: true}).then(function (stream) {
    camera.srcObject = stream;
    camera.addEventListener("loadeddata", predictWebcam);
  });
}

async function predictWebcam() {
  if (camera.currentTime !== lastTime) {
    lastTime = camera.currentTime;
    resultsCache = recognizer.recognizeForVideo(camera, Date.now());
  }
  drawingCanvas.save();
  drawingCanvas.clearRect(0, 0, canvas.width, canvas.height);
  // draw hand landmarks
  const landmarksResult = resultsCache.landmarks;
  if (landmarksResult.length > 0) {
    const utils = new DrawingUtils(drawingCanvas);
    for (const landmarks of landmarksResult) {
      utils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {color: "#646464", lineWidth: 10});
      utils.drawLandmarks(landmarks, {color: "#ffffff", lineWidth: 4});
      x = landmarks[8].x;
      y = landmarks[8].y;
    }
  }
  drawingCanvas.restore();
  // display output
  const gestureResult = resultsCache.gestures;
  if (gestureResult.length > 0) {
    // hands
    let handBuilder = []
    for (const handedness of resultsCache.handednesses) {
      handBuilder.push(oppositeHand(handedness[0].displayName));
    }
    let hands = handBuilder.join(", ");
    // gestures
    let gestureBuilder = []
    let confidenceBuilder = []
    for (const gesture of gestureResult) {
      const currentGesture = gesture[0];
      const name = currentGesture.categoryName;
      gestureBuilder.push(name);
      confidenceBuilder.push((currentGesture.score * 100.0).toFixed(2));
    }
    let gestures = gestureBuilder.join(", ");
    let confidences = confidenceBuilder.join(", ");
    output.innerText = "Hands: " + hands + "\nGestures: " + gestures + "\n Confidences: " + confidences;
  }
  if (cameraStatus === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

async function sendLocation() {
  if (x !== lastX) {
    client.publish(topicX, x.toString())
    lastX = x;
  }
  if (y !== lastY) {
    client.publish(topicY, y.toString())
    lastY = y;
  }
}

async function sendGesture() {
  if (resultsCache === undefined) {
    return;
  }
  if (resultsCache.handednesses.length < 2) {
    return;
  }
  // organize hand data
  const firstHand = oppositeHand(resultsCache.handednesses[0][0].displayName);
  const secondHand = oppositeHand(resultsCache.handednesses[1][0].displayName);
  let rightHand;
  let leftHand;
  if (firstHand === "Right" && secondHand === "Left") {
    rightHand = 0;
    leftHand = 1;
  } else if (firstHand === "Left" && secondHand === "Right") {
    rightHand = 1;
    leftHand = 0;
  } else {
    return;
  }
  // get gestures
  const leftGesture = resultsCache.gestures[leftHand][0].categoryName;
  const rightGesture = resultsCache.gestures[rightHand][0].categoryName;
  const rows = document.getElementById("keybinds").rows;
  // get requirements
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const leftRequirement = row.cells[0].getElementsByTagName("md-outlined-select")[0].value;
    const rightRequirement = row.cells[1].getElementsByTagName("md-outlined-select")[0].value;
    const keybind = row.cells[2].getElementsByTagName("md-outlined-text-field")[0].value;
    // send gesture
    if (keybind === lastKeybind) {
      continue;
    }
    if (leftGesture === leftRequirement && rightGesture === rightRequirement) {
      client.publish(topic, keybind)
      lastKeybind = keybind;
      console.log("Sent gesture: " + keybind);
    }
  }
}
