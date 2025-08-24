DEST_FOLDER=~/.local/share/gnome-shell/extensions/gtile\@lmt.github.io/

make clean
make
cp gtktheme.css metadata.json dist/
cp -r schemas dist/
cp -r src/ui dist/

cp -r dist/* ${DEST_FOLDER}