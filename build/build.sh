DEST_FOLDER=Grimble


if ([ ! -d "$DEST_FOLDER" ]) then
    mkdir ${DEST_FOLDER}
fi

glib-compile-schemas schemas/
make clean
make

./tools/run-eslint.sh dist/*.js dist/prefs/*.js dist/settingsHandlers/*.js --fix

cp gtktheme.css metadata.json ${DEST_FOLDER}
cp -r schemas ${DEST_FOLDER}
cp -r src/ui ${DEST_FOLDER}
cp src/stylesheet.css ${DEST_FOLDER}
cp -r dist/* ${DEST_FOLDER}
cp LICENSE ${DEST_FOLDER}

(cd Grimble && zip -r ../grimble@lmt.github.io.shell-extension.zip ./*)
rm -rf Grimble