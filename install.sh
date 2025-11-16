DEST_FOLDER=~/.local/share/gnome-shell/extensions/grimble\@lmt.github.io/

glib-compile-schemas schemas/
make clean
make

# compile tl: requires gettext
for FILE in translations/*.po; do
    LANG=$(basename "$FILE" .po)
    mkdir -p "dist/locale/$LANG/LC_MESSAGES"
    msgfmt -c "$FILE" -o "dist/locale/$LANG/LC_MESSAGES/grimble@lmt.github.io.mo"
done

cp metadata.json dist/
cp -r src/configs dist/
cp -r schemas dist/
cp -r src/ui dist/
cp src/stylesheet.css dist/

cp -r dist/* ${DEST_FOLDER}