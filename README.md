# Espruino IoT Manager

a command line tool for espruino, esp8266, and esp32 that enables an exellent Developer Experience for these micro-controllers (and others) by:

- watching your IoT app code for changes
- automatically transpiling app modules (via babel) from es6 after a code change
- automatically uglifing / minifing (via uglify-js) your app code to it's smalls size
- converting filenames to appropriate Storage-limited names on the device
- auto-uploading your transpiled files to *Flash* on the device
- creating a custom fileList of filenames and storing to Flash on the device to preserve module-boot order
- creating and uploading a tiny custom .bootcde file which utilizes the fileList of filenames to load your app modules from *Flash* in the correct order, which saves an exponential amount of ram allowing more *jsVars* for your app code.
- additionally allowing you to overcome the 12k filesize upload limit that you face when uploading a single large or concatenated script of all your modules.
- only uploading needed/changed transpiled modules on module-change through caching previously-uploaded transpiled app modules, comparing contenthashes of cached modules vs potentially updated modules, and then uploading only the changed files to the device (similar to, yet slightly different, than hot-module swapping enabled by tools like Webpack, and auto-reloading like Browserify).


# Installation

```
  npm install espruino-iot-manager
```

# Requirements

```
  Node >= 10
```

Also, make sure you flash your device with the appropriate espruino firmware before attempting to load your app code on your device. Instructions for flashing to your specific IoT device can be found at https://www.espruino.com/Other+Boards.



# Usage

Given a directory structure of your espruino app like the following:

```
  node_modules/
   ...
  src/
    domains/                          // your app specific domains / modules, or however 
      createAPSetupFlow/              // you like to structure your apps
        index.js                      
      createDeviceBackendConnector/
        index.js      
      ...
    index.js                          // your entry point in src
```

Simply attach your device via micro USB to USB (or FTDI/serial to USB) to your laptop run the following command:

  esp-iot dev-babel-watch

This will kick off the first transpile, minify, and upload (if needed) of app code, as well as well as upload the needed .bootcde to load and execute your modules from Flash, then establish a cache for any modules changes that follow, and then finally setting up a filesystem watcher to run the transpile/minify/upload/cache flow again.

commandline flags include:

```
  esp-iot dev-babel-watch
    --watch-src   dir/to/watch           
                                        // The dir to watch for app code changes.
                                        // Defaults to ./src/*
                                        // This flag also indicates the entry point of your app, which will live in the specific watch dir, with a filename of index.js
    --port /port/to/espruino             
                                        // The path to the port that your IoT device is connected to.
                                        // Defaults to /dev/tty.SLAB_USBtoUART
                                        // (on the commandline, if you are unsure of your port, run `ls /dev/tty.*` to show available ports to try) 
```


# More Notes

if you are having trouble connecting to your esp8266 (or other IoT device) **the length of the USB / FTDI / Serial cable matters.** I know this sounds absolutely ridicolus (I thought so too), but when I first got started playing with IoT devices and communicating with them via different cables, I **always** found that **SHORTER CABLES WORKED WELL**, while longer USB cables could not consistently keep a connection, which was very, very frustrating. My current micro USB to USB cable is 2 feet and works every time.



