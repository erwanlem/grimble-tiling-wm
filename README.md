<p align=center>
<img src="resources/logo2.png" 
        alt="Grimble" 
        width="300" />
</p>

[<img src="resources/support_me_on_kofi_red.png" alt="Support this project" height="32" />](https://ko-fi.com/erwan_lmt)

# Grimble: Gnome Tiling Window Manager

You like GNOME? You like Tiling Window Managers? You can now have the best of both worlds with **Grimble**, the GNOME tiling window manager extension.

This extension provides the following features:
- Create new tile
- Move tile
- Resize tile
- Maximize tile
- Remove tile

|<img src="resources/screen2.png">|
|:--:|
|Tiles with Grimble|

**Grimble** is **flexible** with its easily **customizable keybindings** and its wide choice of options which let you build the tiling window manager you have always needed! But don't worry, if options and customizations frighten you, **Grimble** is ready to use. Grimble natively supports multiple monitors and workspaces.

*GNOME works with windows, do we really have tiles?* Yes and... no. This extension keeps GNOME windows (we build an extension, not a real window manager) but we endeavor to make it look as if you are dealing with a real tiling window manager!


## System Requirements
This extension is available on all Linux distributions using GNOME.

Currently supports GNOME **46, 47 and 48**.

## Installation
Grimble is available on Gnome Extensions website!

[<img src="https://camo.githubusercontent.com/3afc570a747c1316c234190809a8c4dce26da26ae4e11b913ab7189f4674e366/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f496e7374616c6c25323066726f6d2d657874656e73696f6e732e676e6f6d652e6f72672d3441383643463f7374796c653d666f722d7468652d6261646765266c6f676f3d476e6f6d65266c6f676f436f6c6f723d7768697465"/>](https://extensions.gnome.org/extension/8645/grimble-tiling-wm/)

### Manual

Download the latest release of Grimble.
``` shell
gnome-extensions install grimble@lmt.github.io.shell-extension.zip
```

Once installed, the extension may not show up in the extensions list (especially with Wayland).
If that's the case, log out and log in.

Once installed you can enable the extension with the *Extensions* app or 
with the following command.

``` shell
gnome-extensions enable grimble@lmt.github.io
```
## Uninstall

``` shell
gnome-extensions uninstall grimble@lmt.github.io
```
or remove the extension with the GNOME Shell Extensions app.


## User Guide

Once the extension is installed, you can activate it with the `Extensions` app or via in command line. It will detect existing windows and tile them. It's now time to take a look at the extension settings. You can open the settings from the `Extensions` app or with the shortcut `Ctrl+Super+g`. The settings will show you all the keybindings (which can be modified) and general options of the extension.

**You are now ready to use Grimble!**

## Bug Reports

This extension is in its early days which means that it probably contains bugs. Please create an issue if you find new bugs.
When creating an issue you need to provide some information in order to help us fix it:
- Gnome Shell version (`gnome-shell --version`) and Grimble version.
- Describe how the bug is triggered (how we can reproduce it).
- **One issue = one bug**. Do not report multiple bugs in a single issue.

## Suggestions

This extension is not perfect, if you have suggestions to make it better, feel free to create issues to help improve this extension!
