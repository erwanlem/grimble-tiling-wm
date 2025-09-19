# GTile

*This extension is still in development, bugs report and new features enhancement/suggestion are welcome.*

You like GNOME ? You like Tiling Window Manager ? You can now have the best of both worlds with **GTILE**, the GNOME tiling window manager extension. 

This extension provides the following features:
- Create new tile
- Move tile
- Resize tile
- Maximize tile
- Remove tile

**GTile** is **flexible** with its easily **customizable keybindings** and its wide choice of options which let you build the tiling window manager you have always needed! But no worry, if options and customizations frightened you, **GTile** is a ready to use extension. GTile natively supports multiple monitors and workspaces.

*GNOME works with windows, do we really have tiles ?* Yes and... No. This extension keep GNOME windows (we build an extension not a real window manager) but we endeavor to make it look as if you were dealing with a real tiling window manager! 

[Experimental] You have the choice to **remove GTK top bar** (looks really like tile). This option is disabled by default because it can lead to missing buttons on some apps which put buttons on top bar. Be careful too if you have GTK themes which may override this option **or** may be overridden by this option.

## System requirements
This extension is available on all Linux distribution using Gnome.

Currently supported Gnome versions are Gnome **46, 47 and 48**.

## Installation

### Manual

``` shell
cd gtile
./install
```

## Uninstall

You can run the uninstall script
``` shell
./uninstall
```
or remove the extension with gnome shell extension app.


## User guide

Once the extension is installed you can activate it with the `gnome-extension` app or in command line. It will detect existing windows and place them. It's now time to take a look at the extension settings. You can open the settings from the `gnome-extension` app or with the shortcut `Ctrl+Super+g`. The settings will show you all the keybindings (which can be modified) and general options of the extension.

**You are now ready to use GTile!**

## Bug reports

This extension is on its early days which means that it probably contains bug. Please add an issue if you find new bugs.
To add an issue you need to provide some information in order to help us fix it:
- Gnome Shell version (`gnome-shell --version`) and GTile version.
- Describe how the bug is triggered (how we can reproduce it).
- **One issue = one bug**. Do not create one issue for multiple bugs.

## Suggestions

This extension is not perfect, if you have suggestion to make it better feel free to create issues to improve it!