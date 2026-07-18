---
pageType: mechanics_content
title: "Console commands"
topicGroup: "gettingStarted"
sourceId: "source:ck3-paradoxwikis-com:console-commands"
sourceRevisionId: 35014
sourceOldidUrl: "https://ck3.paradoxwikis.com/Console_commands?oldid=35014"
license: "CC BY-SA 3.0"
generatedAt: "2026-07-18T07:20:18.943Z"
contentHash: "99b3c2cef66272f18bc1242adb904ad9953ccbf388fed7bf65b852b6e17c3b7e"
---

# Console commands

## Source And Attribution

- Source: `source:ck3-paradoxwikis-com:console-commands`
- Revision: <https://ck3.paradoxwikis.com/Console_commands?oldid=35014>
- License: Creative Commons Attribution-ShareAlike 3.0 (`https://creativecommons.org/licenses/by-sa/3.0/`)
- Scope: official CK3 Wiki mechanics documentation; all DLC is assumed active for this project unless a cited source says otherwise.
- Content basis: bounded section notes derived from revision-pinned wiki text. This page is not a full copy of the source article.

## Advisor Use

Use this page when a question needs CK3 mechanics context for Console commands. Combine these mechanics notes with current-save evidence paths and advisor models before giving player advice.

## Mechanics Notes

### Overview

- Crusader Kings III offers a debug mode (disabled by default) that allows the inputting of console commands. This page lists the codes that may be input into the Console Window, a special debugging window that may be accessed in non-ironman games while in debug mode by pressing Shift+2, ALT+2+1, Shift+3, , , , , , or (key varies based upon keyboard layout). For QWERTY keyboards, the key is .

### Debug mode

- Debug mode is a set of game tools that allow to modify game behavior outside of normal means. It includes:
- Debug Menus (including the Portrait Editor, GUI Editor, Tweak Menu and others)
- Debug Character Interactions (user can instantly change opinion, imprison and more)
- Ctrl + clicking on a portrait takes control of the character, while Alt + click kills them
- File watcher that automatically reloads changed files (including mods) into memory

### Enabling debug mode

- Debug mode can be enabled before launching the game and/or toggled in the game using mods. It can be disabled from the console, but can't be re-enabled after it's closed (unless with mods). How to enable it:

### Mods

- There are a number of mods, like Free Console Access and Debug Toggle. They allow to toggle the debug mode on and off, making it convenient to use the console and play, but this doesn't enable instant reloading of files. For modding, it's better to use both a mod and launch options.

### Launcher

- Scroll down to "Open game in Debug Mode" section and click Launch

### Steam

- Add -debug_mode to the Launch Options at the bottom

### Windows

- In the Target field add -debug_mode at the end (so it looks like this "...\ck3.exe" -debug_mode)
- Right click to create a new text file in Notepad

### GOG

- Check "Add command line arguments" and enter debug_mode
- In the game page, select Settings (next to the Play button at the top of the page)
- Open Manage installation and select Configure...
- Make sure the Launch parameters "Custom executables / arguments" is ticked at the bottom of the page. You can duplicate the "startgame" executable and type -debug_mode into the Arguments field.

### Xbox Game Pass

- For the Xbox Game Pass / Windows 10 Store edtion it's more complicated, as you cannot create a normal shortcut for it, so you'll have to run the following commands in Command Prompt every time you open the game: start shell:AppsFolder\ParadoxInteractive.ProjectTitus_zfnrdv2de78ny!App -debug_mode To simplify it, you can also create a batch (.bat) file with this command and run it from the desktop:
- Right-click on your Desktop, choose New -> Text Document.
- Rename it to "ck3.bat". Make sure to remove ".txt" from the end. Confirm changes when prompted.
- Paste the command: start shell:AppsFolder\ParadoxInteractive.ProjectTitus_zfnrdv2de78ny!App -debug_mode

### Disabling debug mode

- To activate achivements again, disable all active mods and remove -debug_mode from launch options. After launching the game, make sure you have the correct checksum. It can be found in the right corner in the Main Menu.

### Debug info

- Debug info can be enabled and disabled either from one of the console buttons or by using the debug_mode command. When debug info is activated, characters, interactions and events will show debug info which is normally hidden during normal gameplay. It should be noted that when debug info is enabled the game will consume a bit more [[mechanics-content/resources|resources]] but it shouldn't have a noticeable effect on most machines.

### Characters

- The following values are shown for characters under debug mode:

### Events

- Hovering over event options will show the AI weight for the option. Also, in the top-right corner of the event window, hovering over the question mark (?) shows internal details, including the following:

### Interactions

- In a given interaction's menu, hovering over the purple R next to the final button will show the root scope, the primary/secondary actors and the primary/secondary recipients.

### Cheats

- Cheats are console commands that can be used to give unfair advantages as opposed to sole testing purposes. Note that pressing the Tab key with the debug window open will show a list of commands, and pressing tab again after typing chosen command will show parameters available for the command in the debug window.

### Spawning artifacts

- Most [[mechanics-content/artifacts|artifacts]] are randomly generated through complex scripts and cannot be spawned with the console. However historical artifacts can be created that way. To spawn an artifact copy one of the following lines in the console. The game will crash without the { OWNER = this } scope.

### Converting commands

- The following commands can be used to convert the realm to a [[mechanics-content/faith|faith]], [[mechanics-content/culture|culture]], [[mechanics-content/government|government]] or [[mechanics-content/titles|title]] hierarchy. Conversion limited to the character's domain can be done via debug interactions (Take Action In Every [[mechanics-content/county|County]]).

### Shattered World mode

- To play on a Shattered World use the following commands:

## Related Wiki Topics

- [[mechanics-content/innovation|Innovation]]
- [[mechanics-content/traits|Traits]]

## Machine Reference

- Mechanics content slug: `console-commands`
- Source title: `Console commands`
- Source page length: `52014`
