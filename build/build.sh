DEST_FOLDER=Grimble


if ([ ! -d "$DEST_FOLDER" ]) then
    mkdir ${DEST_FOLDER}
fi
if ([ ! -d "$DEST_FOLDER/schemas" ]) then
    mkdir ${DEST_FOLDER}/schemas
fi

glib-compile-schemas schemas/
make clean
make

./tools/run-eslint.sh dist/*.js dist/prefs/*.js dist/settingsHandlers/*.js --fix

cp metadata.json ${DEST_FOLDER}
cp schemas/org.gnome.shell.extensions.grimble.gschema.xml ${DEST_FOLDER}/schemas
cp -r src/ui ${DEST_FOLDER}
cp src/stylesheet.css ${DEST_FOLDER}
cp -r dist/* ${DEST_FOLDER}
cp LICENSE ${DEST_FOLDER}

rm Grimble/modalSearchEntry.js

(cd Grimble && zip -r ../grimble@lmt.github.io.shell-extension.zip ./*)
rm -rf Grimble