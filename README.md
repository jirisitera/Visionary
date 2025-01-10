# Visionary

Visionary is a new way of interacting with computers.

The entire system has three main parts:
- the input - the website included in this repository
- the bridge - an MQTT server
- the output - any IoT device capable of connecting to MQTT

The flow of information is pretty straightforward and currently only one-way.

Here's what this system does in a nutshell:
1. The web interface detects your hands' orientations using the MediaPipe Hand Landmarker model.
2. The hand "landmarks" are translated into gestures using the MediaPipe Gesture Recognizer model.
3. The gestures are translated into messages defined by the user in the web interface.
4. The messages are sent over MQTT to the server and topic defined by URL parameters of the web interface.
5. Any IoT device connected to the MQTT server and subscribed to the correct topic receives the message.
6. Finally, the output devices do whatever they are programmed to do with the message received.

The code in this repository was made as part of an academic project and thus is licensed under the Unlicense.
