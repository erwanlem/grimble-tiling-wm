DEST_FOLDER=~/.local/share/gnome-shell/extensions/grimble\@lmt.github.io/

glib-compile-schemas schemas/
make clean
make
cp gtktheme.css metadata.json dist/
cp -r schemas dist/
cp -r src/ui dist/
cp src/stylesheet.css dist/

cp -r dist/* ${DEST_FOLDER}