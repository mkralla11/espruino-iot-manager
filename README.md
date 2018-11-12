# Espruino IoT Manager

a command line tool for espruino, and esp32 that enables an exellent Developer Experience for these micro-controllers (and others) by:

- watching your IoT app code for changes
- automatically transpiling app modules (via babel) from es6 after a code change
- automatically uglifing / minifing (via uglify-js) your app code to it's smallest size
- converting filenames to appropriate Storage-limited names on the device
- auto-uploading your transpiled files to *Flash* on the device
- creating a custom fileList of filenames and storing to Flash on the device to preserve module-boot order
- creating and uploading a tiny custom .bootcde file which utilizes the fileList of filenames to load your app modules from *Flash* in the correct order, which saves an exponential amount of ram allowing more *jsVars* for your app code.
- additionally allowing you to overcome the 12KB filesize upload limit that you face when uploading a single large or concatenated script of all your modules.
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

## Serial Application Code Update Usage
(Suitable boards: espruino, esp8266, esp32)

Simply attach your device via micro USB to USB (or FTDI/serial to USB) to your laptop run the following command:

```
  esp-iot dev-babel-watch
```

This will kick off the first transpile, minify, and upload (if needed) of app code, as well as well as upload the needed .bootcde to load and execute your modules from Flash, then establish a cache for any modules changes that follow, and then finally setting up a filesystem watcher to run the transpile/minify/upload/cache flow again.


## Over The Air (OTA) Application Code Updates Usage
(Suitable boards: esp32)
First, to load the OTA client boot code onto the device so you can perform OTA updates, simply attach your device via micro USB to USB (or FTDI/serial to USB) to your laptop run the following command:

```
  esp-iot init-ota-booter
```

Next, to start serving your application code over-the-air, start your in-memory complication watch server by running the following command:

```
  esp-iot ota-server
```

This will kick off the first transpile, minify, and upload (if needed) of app code, and start a server in order to serve your compiled app code from memory to the device when requested. Finally it sets up a filesystem watcher to run the transpile/minify/upload/cache flow again.


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

Also, each *individual module* that is imported/required by your app code must be less than or equal to 4KB due to the fact that each module is stored in Flash, and the max block size is 4KB per stored item. Although this may seem like a limitation for this upload/boot/run strategy, *it actually coaxes you to think more modularly, implicitly helping you to seperate each of your ideas into well encapsulated modules, and importing them to create your whole idea.* Not only that, but by storing and executing each module in *Flash*, you end up saving RAM, allowing you to have more jsVars in your app code, which is a huge win! The Flash idea is *based off of* [thread](http://forum.espruino.com/conversations/290975/), so feel free to skim it for a general understanding (note that some info in the thread is based on older info, like some of the numbers/totals that are used).

# Practical / Real-world Memory-savings and Flash Totals

For a more practical sense of how rewarding running your code from Flash is, here are the details of my current espruino modularize app transpiled/minified/uploaded using this command line tool:

| Name                  | Details        |
| ----                  | -----          |
| Board                 | esp8266        |
| Board Type            | 12e            |
| Flash space           | 4 MB           |
| jsVars                | 1700           |
| Espruino Firmware v.  | 1v99           |


| My Current Real-world **App Code**  | Details        |
| ----                                | -----          |
| Total modules                       | 13             |
| Largest module size minified        | 3.850 KB       |
| Total modules size minified         | **15 KB**      |
| Total jsVars left after upload      | 900            |

The most impressive aspect of these numbers is the fact that I've uploaded a total of **15 KB of modules** seperately to Flash, and I'm still left with 900 of of **1700 jsVars**. Also, one of my previous upload strategies attempted to concatenate all of my modules and write them directly to the .bootcde file uploaded to the device. This was great until I hit the 12KB file limit when writing to .bootcde, which ended up causing the watchdog timeout to repeatedly cause a reboot of my app. So using my new strategy was a huge win, seeing as I couldn't even *run* my large app without it.

## Wipe out all files

require('fs').readdirSync('').forEach(function(item){
require('fs').unlink(item)})
require('Storage').eraseAll()


# License

Licensed under MIT
