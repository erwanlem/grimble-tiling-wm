DEST_FOLDER=GTile


if ([ ! -d "$DEST_FOLDER" ]) then
    mkdir ${DEST_FOLDER}
fi

glib-compile-schemas schemas/
make clean
make
cp gtktheme.css metadata.json ${DEST_FOLDER}
cp -r schemas ${DEST_FOLDER}
cp -r src/ui ${DEST_FOLDER}
cp src/stylesheet.css ${DEST_FOLDER}
cp -r dist/* ${DEST_FOLDER}

(cd GTile && zip -r ../gtile@lmt.github.io.shell-extension.zip ./*)
rm -rf GTile