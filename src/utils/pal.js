const electron = require('electron');
const app = electron.app || electron.remote.app;
const shell = electron.shell || electron.remote.shell;
const dialog = electron.dialog || electron.remote.dialog;
const fs = require('fs');

export function getAppVersion() {
    return app.getVersion();
}

export function getAppPath(name) {
    app.getPath(name);
}

export function openShellExternal(url) {
    shell.openExternal(url);
}

export function download(filename, text, title, buttonLabel) {
    // For the browser:
    /*var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename);

    if (document.createEvent) {
        var event = document.createEvent('MouseEvents');
        event.initEvent('click', true, true);
        pom.dispatchEvent(event);
    }
    else {
        pom.click();
    }*/

    // For Electron:

    //TODO: filters based on file extension
    dialog.showSaveDialog(
        {
            filters: [{ name: 'Comma separated file (*.csv)', extensions: ['csv'] }],
            title: title,
            defaultPath: filename,
            buttonLabel: buttonLabel
        },
        (fileName) => {
            if (fileName === undefined)
                return;

            fs.writeFile(fileName, text, (err) => {
                if (!err) {
                    shell.openItem(fileName);
                }
            });

        });
}